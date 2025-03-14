'use client'

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import type { RouterOutputs } from '@yuki/api'
import { Button } from '@yuki/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@yuki/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@yuki/ui/form'
import { toast } from '@yuki/ui/sonner'
import { cn } from '@yuki/ui/utils'

import { useTRPC } from '@/lib/trpc/react'

export const CreatePostForm: React.FC = () => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { mutate, isPending, error } = useMutation(
    trpc.post.create.mutationOptions({
      onSuccess: async () =>
        queryClient.invalidateQueries(trpc.post.pathFilter()),
      onError: (e) => toast.error(e.message),
    }),
  )

  return (
    <Form<typeof mutate>
      className="w-full max-w-2xl"
      defaultValues={{ title: '', content: '' }}
      onSubmit={mutate}
      isPending={isPending}
      errors={error?.data?.zodError}
    >
      <FormField
        name="title"
        render={(field) => (
          <FormItem>
            <FormControl placeholder="What's on your mind?" {...field} />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="content"
        render={(field) => (
          <FormItem>
            <FormControl placeholder="Tell us more" {...field} />
            <FormMessage />
          </FormItem>
        )}
      />

      <Button className="w-full" disabled={isPending}>
        Create
      </Button>
    </Form>
  )
}

export const PostList: React.FC = () => {
  const trpc = useTRPC()
  const { data: posts } = useSuspenseQuery(trpc.post.all.queryOptions())

  return (
    <div className="flex w-full flex-col gap-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  )
}

export const PostCard: React.FC<{
  post: RouterOutputs['post']['all'][number]
}> = ({ post }) => {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const deletePost = useMutation(
    trpc.post.delete.mutationOptions({
      onSuccess: async () =>
        queryClient.invalidateQueries(trpc.post.pathFilter()),
      onError: (e) => toast.error(e.message),
    }),
  )

  return (
    <Card className="flex justify-between">
      <CardHeader>
        <CardTitle>{post.title}</CardTitle>
        <CardDescription>{post.content}</CardDescription>
      </CardHeader>
      <Button
        variant="ghost"
        className="m-6 ml-0"
        onClick={() => {
          deletePost.mutate(post)
        }}
      >
        Delete
      </Button>
    </Card>
  )
}

export const PostCardSkeleton: React.FC<{ pulse?: boolean }> = ({
  pulse = true,
}) => (
  <Card>
    <CardHeader>
      <CardTitle
        className={cn('bg-primary w-1/4 rounded', pulse && 'animate-pulse')}
      >
        &nbsp;
      </CardTitle>
      <CardDescription
        className={cn('w-1/3 rounded bg-current', pulse && 'animate-pulse')}
      >
        &nbsp;
      </CardDescription>
    </CardHeader>
  </Card>
)
