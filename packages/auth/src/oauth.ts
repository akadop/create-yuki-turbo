import { Discord, generateState, GitHub, OAuth2RequestError } from 'arctic'

import { env } from '@yuki/auth/env'
import { db } from '@yuki/db'

class OAuth {
  private name: string
  private provider: Discord | GitHub
  private scopes: string[]
  private fetchUserUrl: string
  private mapFn: (data: unknown) => {
    id: string
    email: string
    name: string
    image: string
  }

  private oauthUser: {
    id: string
    email: string
    name: string
    image: string
  } = { id: '', email: '', name: '', image: '' }

  constructor(provider: string, callbackUrl: string) {
    const providers = {
      discord: {
        instance: new Discord(env.DISCORD_ID, env.DISCORD_SECRET, callbackUrl),
        scopes: ['identify', 'email'],
        fetchUserUrl: 'https://discord.com/api/users/@me',
        mapFn: (data: {
          id: string
          email: string
          username: string
          avatar: string
        }) => ({
          id: data.id,
          email: data.email,
          name: data.username,
          image: `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`,
        }),
      },
      github: {
        instance: new GitHub(env.GITHUB_ID, env.GITHUB_SECRET, callbackUrl),
        scopes: ['user:email'],
        fetchUserUrl: 'https://api.github.com/user',
        mapFn: (data: {
          id: string
          email: string
          login: string
          avatar_url: string
        }) => ({
          id: String(data.id),
          email: data.email,
          name: data.login,
          image: data.avatar_url,
        }),
      },
    }

    const providerConfig = providers[provider as keyof typeof providers]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!providerConfig) throw new Error(`Provider "${provider}" is not supported`)

    this.name = provider
    this.provider = providerConfig.instance
    this.scopes = providerConfig.scopes
    this.fetchUserUrl = providerConfig.fetchUserUrl
    // @ts-expect-error - OAuth provider have different number of arguments
    this.mapFn = providerConfig.mapFn
  }

  public getOAuthUrl(): { url: URL; state: string } {
    const state = generateState()
    const createAuthURL = this.provider.createAuthorizationURL.bind(this.provider)

    const url =
      createAuthURL.length === 3
        ? // @ts-expect-error - 2nd argument is optional
          createAuthURL(state, null, this.scopes)
        : // @ts-expect-error - OAuth provider have different number of arguments
          createAuthURL(state, this.scopes)

    return { url, state }
  }

  public async callback(url: URL, storedState?: string) {
    const code = url.searchParams.get('code') ?? ''
    const state = url.searchParams.get('state') ?? ''

    if (!code || !state || state !== storedState) throw new Error('Invalid state')

    const validateCode = this.provider.validateAuthorizationCode.bind(this.provider)
    const tokens =
      // @ts-expect-error - OAuth provider have different number of arguments
      validateCode.length === 2 ? await validateCode(code, '') : await validateCode(code)
    const token = tokens.accessToken()

    await this.fetchUser(token)
    return this.createUser()
  }

  private async fetchUser(token: string) {
    const res = await fetch(this.fetchUserUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Failed to fetch user data from ${this.name}`)
    this.oauthUser = this.mapFn(await res.json())
  }

  private async createUser() {
    const { id, email, name, image } = this.oauthUser

    const existingAccount = await db.account.findUnique({
      where: { provider_providerId: { provider: this.name, providerId: id } },
    })

    if (existingAccount) {
      const user = await db.user.findUnique({ where: { id: existingAccount.userId } })
      if (!user) throw new Error(`Failed to sign in with ${this.name}`)
      return user
    }

    const accountData = {
      provider: this.name,
      providerId: id,
      providerName: name,
    }
    return await db.user.upsert({
      where: { email },
      update: { accounts: { create: accountData } },
      create: {
        email,
        name,
        image,
        accounts: { create: accountData },
      },
    })
  }
}

export { OAuth, OAuth2RequestError }
