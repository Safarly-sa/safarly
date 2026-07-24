import { Component, lazy, Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { I18nProvider } from '@/providers/I18nProvider';

import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { Footer } from '@/components/Footer';

import { Home } from '@/pages/home';

/**
 * Every route but Home is lazy — Home stays eager so first paint of the
 * landing page isn't gated on a chunk fetch, the same reasoning HomeBelowFold
 * already uses for its own below-fold sections.
 *
 * Itinerary is the one that matters most: at 2700+ lines it's the largest
 * page in the app AND the only importer of Leaflet, a full mapping library
 * that had no business sitting in the bundle every visitor downloads on
 * first paint just to browse the home page.
 */
const Login          = lazy(() => import('@/pages/login').then(m => ({ default: m.Login })));
const ForgotPassword  = lazy(() => import('@/pages/forgot-password').then(m => ({ default: m.ForgotPassword })));
const ResetPassword   = lazy(() => import('@/pages/reset-password').then(m => ({ default: m.ResetPassword })));
const ProfileSetup    = lazy(() => import('@/pages/profile-setup').then(m => ({ default: m.ProfileSetup })));
const Profile         = lazy(() => import('@/pages/profile').then(m => ({ default: m.Profile })));
const Trip            = lazy(() => import('@/pages/trip').then(m => ({ default: m.Trip })));
const Generating      = lazy(() => import('@/pages/generating').then(m => ({ default: m.Generating })));
const Itinerary       = lazy(() => import('@/pages/itinerary').then(m => ({ default: m.Itinerary })));
const Lens            = lazy(() => import('@/pages/lens').then(m => ({ default: m.Lens })));
const Dialect         = lazy(() => import('@/pages/dialect').then(m => ({ default: m.Dialect })));
const Dashboard       = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.Dashboard })));
const About           = lazy(() => import('@/pages/about').then(m => ({ default: m.About })));
const Vision2030      = lazy(() => import('@/pages/vision-2030').then(m => ({ default: m.Vision2030 })));
const NotFound        = lazy(() => import('@/pages/not-found'));

/* ── Error boundary ─────────────────────────────────────────────────── */
interface EBState { error: Error | null }

class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100dvh', padding: '40px 20px',
          background: 'var(--sf-bg)', color: 'var(--sf-text)', textAlign: 'center',
          gap: '16px',
        }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>Something went wrong</p>
          <p style={{ color: 'var(--sf-text-muted)', fontSize: '0.875rem', maxWidth: '420px', lineHeight: 1.6 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              marginTop: '8px', padding: '12px 28px', borderRadius: '10px',
              border: 'none', background: 'var(--sf-accent)', color: '#0A0E16',
              fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-background text-foreground">
      <Navbar />
      <main className="flex-1 w-full relative">
        {/* One boundary for every lazy route. A blank `min-h-[60vh]` rather
            than a spinner: navigating within the app already shows the
            Navbar/Footer chrome instantly, so a full loading indicator would
            fight with those — the route's own content is the loading state. */}
        <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
          <Switch>
            <Route path="/" component={Home} />

            <Route path="/login"         component={Login} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/reset-password"  component={ResetPassword} />
            <Route path="/profile-setup" component={ProfileSetup} />
            <Route path="/profile"       component={Profile} />
            {/* Legacy redirect: old /onboarding links go to /login */}
            <Route path="/onboarding"    component={Login} />

            <Route path="/trip" component={Trip} />

            <Route path="/generating" component={Generating} />

            <Route path="/itinerary" component={Itinerary} />

            <Route path="/about"     component={About} />
            <Route path="/vision-2030" component={Vision2030} />
            <Route path="/lens"      component={Lens} />
            <Route path="/dialect"   component={Dialect} />
            <Route path="/dashboard" component={Dashboard} />

            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppErrorBoundary>
          <I18nProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </I18nProvider>
        </AppErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;