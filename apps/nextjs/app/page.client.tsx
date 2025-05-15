'use client'

import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'

import type { RouterOutputs } from '@yuki/api'
import { Button } from '@yuki/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yuki/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from '@yuki/ui/form'
import { Loader2Icon, RotateCcwIcon, TrashIcon } from '@yuki/ui/icons'
import { Input } from '@yuki/ui/input'
import { toast } from '@yuki/ui/sonner'
import { createPostSchema } from '@yuki/validators/post'

import { useTRPC } from '@/lib/trpc/react'

export const CreatePost: React.FC = () => {
  const { trpc, trpcClient, queryClient } = useTRPC()

  const form = useForm({
    schema: createPostSchema,
    defaultValues: { title: '', content: '' },
    submitFn: trpcClient.post.create.mutate,
    onSuccess: async () => {
      await queryClient.invalidateQueries(trpc.post.all.queryFilter())
      form.reset()
    },
    onError: (error) => {
      toast.error(error)
    },
  })

  return (
    <Card>
      <CardContent>
        <Form form={form}>
          <FormField
            name="title"
            render={(field) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl {...field}>
                  <Input placeholder="What's on your mind?" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="content"
            render={(field) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl {...field}>
                  <Input placeholder="What's on your mind?" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button disabled={form.isPending}>Create Post</Button>
        </Form>
      </CardContent>
    </Card>
  )
}

export const PostList: React.FC = () => {
  const { trpc } = useTRPC()
  const { data } = useSuspenseQuery(trpc.post.all.queryOptions())

  return data.map((post) => <PostCard key={post.id} post={post} />)
}

export const SubscriptionStatus: React.FC = () => {
  const { trpc, queryClient } = useTRPC()
  const { status, reset } = useSubscription(
    trpc.post.onUpdate.subscriptionOptions(undefined, {
      onData: ({ action, data }) => {
        switch (action) {
          case 'create':
            queryClient.setQueryData(trpc.post.all.queryKey(), (oldData) => [
              data,
              ...(oldData ?? []),
            ])
            break
          case 'delete':
            queryClient.setQueryData(trpc.post.all.queryKey(), (oldData) => {
              if (!oldData) return oldData
              return oldData.filter((post) => post.id !== data.id)
            })
            break
        }
      },
    }),
  )

  return (
    <div className="flex items-center justify-end gap-2">
      <span>{status}</span>
      <Button size="icon" onClick={reset}>
        <RotateCcwIcon />
      </Button>
    </div>
  )
}

const PostCard: React.FC<{ post: RouterOutputs['post']['all'][number] }> = ({
  post,
}) => {
  const { trpc, queryClient } = useTRPC()
  const { mutate, isPending } = useMutation(
    trpc.post.delete.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: () =>
        queryClient.invalidateQueries(trpc.post.all.queryFilter()),
    }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{post.title}</CardTitle>
        <CardDescription>{post.createdAt.toDateString()}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              mutate({ id: post.id })
            }}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <TrashIcon />
            )}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <p>{post.content}</p>
      </CardContent>
    </Card>
  )
}

export const PostCardSkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <CardTitle className="w-1/3 animate-pulse rounded-lg bg-current">
        &nbsp;
      </CardTitle>
      <CardDescription className="w-1/4 animate-pulse rounded-lg bg-current">
        &nbsp;
      </CardDescription>
    </CardHeader>

    <CardContent>
      <p className="h-20 animate-pulse rounded-lg bg-current">&nbsp;</p>
    </CardContent>
  </Card>
)
