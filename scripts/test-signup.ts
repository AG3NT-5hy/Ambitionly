import superjson from 'superjson';
import { createTRPCProxyClient, httpLink } from '@trpc/client';

const wrappedSuperjson = {
  ...superjson,
  deserialize: (data: any) => {
    return superjson.deserialize(data);
  },
  serialize: (data: any) => {
    return superjson.serialize(data);
  },
};

const client = createTRPCProxyClient({
  transformer: wrappedSuperjson,
  links: [
    httpLink({
      url: 'https://ambitionly.onrender.com/api/trpc',
      fetch: async (url, options) => {
        console.log('Request URL:', url);
        console.log('Request body:', options?.body);
        const res = await fetch(url, options as any);
        const text = await res.clone().text();
        console.log('Response:', text);
        return res as any;
      },
    }),
  ],
});

async function main() {
  const email = `test+${Date.now()}@example.com`;
  const result = await client.auth.signup.mutate({
    email,
    password: 'password123',
  });
  console.log('Result:', result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

