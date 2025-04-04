import type { OAuth2Tokens } from 'arctic'
import { cookies } from 'next/headers'
import { generateCodeVerifier, generateState, OAuth2RequestError } from 'arctic'

import type { User } from '@yuki/db'
import { db } from '@yuki/db'
import { env } from '@yuki/env'

import type { SessionResult } from './session'
import { Session } from './session'

type Providers = Record<
  string,
  {
    createAuthorizationURL: (state: string, codeVerifier: string) => URL
    validateAuthorizationCode: (
      code: string,
      codeVerifier: string,
    ) => Promise<OAuth2Tokens>
    fetchUserUrl: string
    mapUser: (user: never) => {
      provider: string
      providerAccountId: string
      providerAccountName: string
      email: string
      image: string
    }
  }
>

export interface AuthOptions<T extends Providers = Providers> {
  cookieKey: string
  providers: T
}

export class Auth<TProviders extends Providers> {
  private readonly db: typeof db
  private readonly session: Session

  private readonly COOKIE_KEY: string
  private readonly providers: TProviders

  constructor(options: AuthOptions<TProviders>) {
    this.COOKIE_KEY = options.cookieKey
    this.providers = options.providers

    this.db = db
    this.session = new Session()
  }

  public async auth(req?: Request): Promise<SessionResult> {
    const authToken = await this.getCookie(req)
    if (!authToken) return { expires: new Date() }
    return await this.session.validateSessionToken(authToken)
  }

  public async handlers(req: Request): Promise<Response> {
    const url = new URL(req.url)

    let response: Response = Response.json(
      { error: 'Not found' },
      { status: 404 },
    )

    try {
      if (req.method === 'OPTIONS') {
        response = Response.json('', { status: 204 })
      } else if (req.method === 'GET') {
        response = await this.handleGetRequests(req, url)
      } else if (
        req.method === 'POST' &&
        url.pathname === '/api/auth/sign-out'
      ) {
        await this.signOut(req)
        response = new Response('', {
          headers: new Headers({ Location: '/' }),
          status: 302,
        })
        response.headers.set('Set-Cookie', this.deleteCookie(this.COOKIE_KEY))
      }
    } catch (error) {
      response = this.handleError(error)
    }

    this.setCorsHeaders(response)
    return response
  }

  public async signOut(req?: Request): Promise<void> {
    const token = await this.getCookie(req)
    if (token) await this.session.invalidateSessionToken(token)
  }

  private async handleGetRequests(req: Request, url: URL): Promise<Response> {
    if (url.pathname === '/api/auth') {
      const session = await this.auth(req)
      return Response.json(session)
    }

    if (url.pathname.startsWith('/api/auth/oauth'))
      return await this.handleOAuthRequest(req, url)

    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  private async handleOAuthRequest(req: Request, url: URL): Promise<Response> {
    const isCallback = url.pathname.endsWith('/callback')

    if (!isCallback) return this.handleOAuthStart(url)
    else return await this.handleOAuthCallback(req, url)
  }

  private handleOAuthStart(url: URL): Response {
    const providerName = String(url.pathname.split('/').pop())
    const provider = this.providers[providerName]

    if (!provider)
      return Response.json({ error: 'Provider not supported' }, { status: 404 })

    const state = generateState()
    const codeVerifier = generateCodeVerifier()
    const authorizationUrl = provider.createAuthorizationURL(
      state,
      codeVerifier,
    )

    const response = new Response('', {
      headers: new Headers({ Location: authorizationUrl.toString() }),
      status: 302,
    })
    response.headers.append(
      'Set-Cookie',
      this.setCookie('oauth_state', state, {
        Path: '/',
        HttpOnly: '',
        SameSite: 'Lax',
      }),
    )
    response.headers.append(
      'Set-Cookie',
      this.setCookie('code_verifier', codeVerifier, {
        Path: '/',
        HttpOnly: '',
        SameSite: 'Lax',
      }),
    )

    return response
  }

  private async handleOAuthCallback(req: Request, url: URL): Promise<Response> {
    const providerName = String(url.pathname.split('/').slice(-2)[0])
    const provider = this.providers[providerName]

    if (!provider)
      return Response.json({ error: 'Provider not supported' }, { status: 404 })

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const storedState = await this.getCookie(req, 'oauth_state')
    const codeVerifier = await this.getCookie(req, 'code_verifier')

    if (!code || !state || state !== storedState)
      throw new Error('Invalid state')

    const { validateAuthorizationCode, fetchUserUrl, mapUser } = provider
    const verifiedCode = await validateAuthorizationCode(code, codeVerifier)
    const token = verifiedCode.accessToken()

    const res = await fetch(fetchUserUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Failed to fetch user data')

    const user = await this.createUser(mapUser((await res.json()) as never))
    const session = await this.session.createSession(user.id)

    const response = new Response('', {
      headers: new Headers({ Location: '/' }),
      status: 302,
    })
    response.headers.set(
      'Set-Cookie',
      this.setCookie(this.COOKIE_KEY, session.sessionToken, {
        Path: '/',
        HttpOnly: 'true',
        SameSite: 'Lax',
        Secure: env.NODE_ENV === 'production' ? 'true' : 'false',
        Expires: session.expires.toUTCString(),
      }),
    )
    response.headers.append('Set-Cookie', this.deleteCookie('oauth_state'))
    response.headers.append('Set-Cookie', this.deleteCookie('code_verifier'))

    return response
  }

  private handleError(error: unknown): Response {
    if (error instanceof OAuth2RequestError)
      return Response.json(
        { error: error.message, description: error.description },
        { status: 400 },
      )

    if (error instanceof Error)
      return Response.json({ error: error.message }, { status: 400 })

    return Response.json(
      { error: 'An unknown error occurred' },
      { status: 400 },
    )
  }

  private async createUser(data: {
    provider: string
    providerAccountId: string
    providerAccountName: string
    email: string
    image: string
  }): Promise<User> {
    const { provider, providerAccountId, providerAccountName, email, image } =
      data

    const existingAccount = await this.db.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
    })

    if (existingAccount) {
      const user = await this.db.user.findUnique({
        where: { id: existingAccount.userId },
      })
      if (!user) throw new Error(`Failed to sign in with ${provider}`)
      return user
    }

    const accountData = {
      provider,
      providerAccountId,
      providerAccountName,
    }

    return await this.db.user.upsert({
      where: { email },
      update: { accounts: { create: accountData } },
      create: {
        email,
        name: providerAccountName,
        image,
        accounts: { create: accountData },
      },
    })
  }

  private async getCookie(
    req?: Request,
    key: string = this.COOKIE_KEY,
  ): Promise<string> {
    if (req)
      return (
        req.headers.get('cookie')?.match(new RegExp(`${key}=([^;]+)`))?.[1] ??
        (key === this.COOKIE_KEY ? req.headers.get('Authorization') : '') ??
        ''
      )

    return (await cookies()).get(key)?.value ?? ''
  }

  private setCookie(
    key: string,
    value: string,
    attributes: Record<string, string | number>,
  ): string {
    const cookie = `${key}=${value}; ${Object.entries(attributes)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')}`
    return cookie
  }

  private deleteCookie(key: string): string {
    return `${key}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ${env.NODE_ENV === 'production' ? 'Secure;' : ''}`
  }

  private setCorsHeaders(res: Response): void {
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Request-Method', '*')
    res.headers.set('Access-Control-Allow-Methods', 'OPTIONS, GET, POST')
    res.headers.set('Access-Control-Allow-Headers', '*')
  }
}
