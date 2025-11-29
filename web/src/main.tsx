import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Outlet,
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Index } from './routes'
import { SessionPage } from './routes/SessionPage'
import { SessionJudgePage } from './routes/SessionJudgePage'
import { getEntrantList, getSession } from './api'

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Index
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/s/$sessionId',
  loader: async ({ params }) => {
    const session = await getSession(params.sessionId);
    const entrants = await getEntrantList(params.sessionId);
    return {session, entrants};
  },
  component: SessionPage,
});

const sessionJudgeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/s/$sessionId/judge',
  loader: async ({ params }) => {
    const session = await getSession(params.sessionId);
    const entrants = await getEntrantList(params.sessionId);
    return {session, entrants};
  },
  component: SessionJudgePage,
});

const routeTree = rootRoute.addChildren([indexRoute, sessionRoute, sessionJudgeRoute]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

