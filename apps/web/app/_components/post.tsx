'use client'

import type { RouterOutputs } from '@yuki/api'
import { Button } from '@yuki/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@yuki/ui/card'
import { Input } from '@yuki/ui/input'
import { toast } from '@yuki/ui/sonner'
import { cn } from '@yuki/ui/utils'

import { api } from '@/lib/trpc/react'

export const CreatePostForm: React.FC = () => {
  const utils = api.useUtils()
  const createPost = api.post.create.useMutation({
    onSuccess: async () => utils.post.invalidate(),
    onError: (e) => toast.error(e.message),
  })

  return (
    <form
      className="flex w-full max-w-2xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        createPost.mutate({
          title: fd.get('title') as string,
          content: fd.get('content') as string,
        })
        e.currentTarget.reset()
      }}
    >
      <Input name="title" placeholder="What's on your mind?" />
      <Input name="content" placeholder="Tell us more" />
      <Button disabled={createPost.isPending}>Create</Button>
    </form>
  )
}

export const PostList: React.FC = () => {
  const [posts] = api.post.all.useSuspenseQuery()

  return (
    <div className="flex w-full flex-col gap-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  )
}

export const PostCard: React.FC<{ post: RouterOutputs['post']['all'][number] }> = ({
  post,
}) => {
  const utils = api.useUtils()
  const deletePost = api.post.delete.useMutation({
    onSuccess: async () => utils.post.invalidate(),
    onError: (e) => toast.error(e.message),
  })

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

export const PostCardSkeleton: React.FC<{ pulse?: boolean }> = ({ pulse = true }) => (
  <Card>
    <CardHeader>
      <CardTitle className={cn('bg-primary w-1/4 rounded', pulse && 'animate-pulse')}>
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
