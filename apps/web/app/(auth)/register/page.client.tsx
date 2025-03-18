'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@yuki/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from '@yuki/ui/form'
import { Input } from '@yuki/ui/input'
import { toast } from '@yuki/ui/sonner'
import { signUpSchema } from '@yuki/validators/auth'

import { useTRPCClient } from '@/lib/trpc/react'

export const RegisterForm: React.FC = () => {
  const router = useRouter()
  const trpcClient = useTRPCClient()

  const form = useForm({
    schema: signUpSchema,
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    submitFn: async (values) => trpcClient.auth.signUp.mutate(values),
    onSuccess: () => {
      toast.success('You have successfully registered!')
      router.push('/login')
    },
    onError: (error) => {
      toast.error(error)
    },
  })

  return (
    <Form form={form}>
      {formItems.map((item) => (
        <FormField
          key={item.name}
          name={item.name}
          render={(field) => (
            <FormItem>
              <FormLabel>{item.label}</FormLabel>
              <FormControl {...field}>
                <Input {...item} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}

      <Button disabled={form.isPending}>Register</Button>
    </Form>
  )
}

const formItems = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Yuki',
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'yuki@example.com',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: '••••••••',
  },
  {
    name: 'confirmPassword',
    label: 'Confirm Password',
    type: 'password',
    placeholder: '••••••••',
  },
]
