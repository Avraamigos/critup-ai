import { initializePaddle, type Paddle } from '@paddle/paddle-js'

let instance: Paddle | undefined

export async function getPaddle(): Promise<Paddle | undefined> {
  if (instance) return instance
  instance = await initializePaddle({
    environment: 'production',
    token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string,
  })
  return instance
}

export const PRICE_IDS = {
  monthly: import.meta.env.VITE_PADDLE_MONTHLY_PRICE_ID as string,
  yearly:  import.meta.env.VITE_PADDLE_YEARLY_PRICE_ID  as string,
}
