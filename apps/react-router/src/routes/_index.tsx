import { Suspense } from 'react'
import { Link } from 'react-router'

import { auth } from '@yuki/auth'
import { useSession } from '@yuki/auth/react'
import { Button } from '@yuki/ui/button'
import { Typography } from '@yuki/ui/typography'

import type { Route } from './+types/_index'
import { CreatePost, PostCardSkeleton, PostList } from '@/components/post'
import { HydrateClient } from '@/lib/trpc/react'
import { prefetch, trpc } from '@/lib/trpc/server'

export const loader = async ({ request }: Route.LoaderArgs) => {
  prefetch(trpc(request.headers).post.all.queryOptions())
  const session = await auth(request)

  return { session }
}

export default function HomePage({
  loaderData: { session },
}: Route.ComponentProps) {
  const d = useSession()
  console.log(d)

  return (
    <HydrateClient>
      <main className="container max-w-2xl py-4">
        <Typography variant="h1" className="text-center">
          Create
          <span className="text-[#78a9ff]"> Yuki </span>
          Turbo
        </Typography>

        <Typography size="lg" className="text-center">
          A type-safe fullstack framework for building web applications.
        </Typography>

        <section className="mt-4 flex flex-col gap-4">
          <h2 className="sr-only">Authenticating Section</h2>

          {!session.user && (
            <Button asChild>
              <Link to="/login">Login</Link>
            </Button>
          )}

          {session.user && (
            <div className="flex justify-between">
              <Typography variant="h3">Welcome, {session.user.name}</Typography>
              <form action="/api/auth/sign-out" method="POST">
                <Button variant="secondary">Logout</Button>
              </form>
            </div>
          )}
        </section>

        <section className="mt-4 flex flex-col gap-4">
          <h2 className="sr-only">Posts List Section</h2>

          <CreatePost />

          <Suspense
            fallback={Array.from({ length: 5 }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          >
            <PostList />
          </Suspense>
        </section>
      </main>
    </HydrateClient>
  )
}
