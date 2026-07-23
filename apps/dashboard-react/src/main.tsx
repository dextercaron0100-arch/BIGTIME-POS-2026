import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SiteMotionProvider } from './components/motion/site-motion-provider'
import './index.css'
import { realtime } from './lib/realtime'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

// Connect WebSocket for realtime sync between dashboard, POS terminals, and API
realtime.connect(queryClient)

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <SiteMotionProvider>
      <App />
    </SiteMotionProvider>
  </QueryClientProvider>,
)
