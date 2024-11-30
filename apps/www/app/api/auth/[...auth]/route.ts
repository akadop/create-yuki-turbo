import { oauth } from '@yuki/auth/oauth'

import { getBaseUrl } from '@/lib/utils'

export const runtime = 'edge'

export const GET = oauth(getBaseUrl())
