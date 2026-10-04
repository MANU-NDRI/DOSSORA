import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { AccountLayout } from '@/layouts/AccountLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { RequireAdmin, RequireAuth } from '@/components/Guards';
import { SplashLoader } from '@/components/Brand';
import { Toaster } from '@/components/Toaster';
import { NotFound, PageSpinner } from '@/components/ui';
import { AdminLanguageGate } from '@/components/AdminLanguageGate';
import { LangScopeContext, useT, type LangScope } from '@/i18n';
import { useAuth } from '@/store/auth';

const Home = lazy(() => import('@/pages/Home'));
const Shop = lazy(() => import('@/pages/Shop'));
const ProductPage = lazy(() => import('@/pages/ProductPage'));
const CartPage = lazy(() => import('@/pages/CartPage'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const Favorites = lazy(() => import('@/pages/Favorites'));
const LegalPage = lazy(() => import('@/pages/legal/LegalPage'));
const Login = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.Register })));
const Forgot = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.ForgotPassword })));
const Reset = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.ResetPassword })));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));

const Dashboard = lazy(() => import('@/pages/account/Dashboard'));
const Orders = lazy(() => import('@/pages/account/Orders'));
const OrderDetail = lazy(() => import('@/pages/account/OrderDetail'));
const Profile = lazy(() => import('@/pages/account/Profile'));
const Addresses = lazy(() => import('@/pages/account/Addresses'));
const Security = lazy(() => import('@/pages/account/Security'));
const Notifications = lazy(() => import('@/pages/account/Notifications'));
const Messages = lazy(() => import('@/pages/account/Messages'));

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'));
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminInventory = lazy(() => import('@/pages/admin/AdminInventory'));
const AdminCustomers = lazy(() => import('@/pages/admin/AdminCustomers'));
const AdminCustomerDetail = lazy(() => import('@/pages/admin/AdminCustomerDetail'));
const AdminNewsletter = lazy(() => import('@/pages/admin/AdminNewsletter'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminMessages = lazy(() => import('@/pages/admin/AdminMessages'));
const AdminPromotions = lazy(() => import('@/pages/admin/AdminPromotions'));
const AdminShipping = lazy(() => import('@/pages/admin/AdminShipping'));
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'));
const AdminHomepage = lazy(() => import('@/pages/admin/AdminHomepage'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const OrderLabel = lazy(() => import('@/pages/admin/OrderLabel'));

function LangSync() {
  const { lang, dir } = useT();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir; // arabe → RTL sur tout le site
  }, [lang, dir]);
  return null;
}
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

const SPLASH_KEY = 'dossora_splash_seen';
const scopeOf = (pathname: string): LangScope => (pathname === '/admin' || pathname.startsWith('/admin/') ? 'admin' : 'client');

export default function App() {
  const scope = scopeOf(useLocation().pathname);
  const init = useAuth((s) => s.init);
  const ready = useAuth((s) => s.ready);
  // Splash complet à la première ouverture de la session ; ensuite uniquement le temps d'initialiser la session.
  // Déjà vu pendant cette session : aucun splash (ni flash) aux rechargements et navigations suivantes.
  const [splashSeen] = useState(() => {
    try {
      return sessionStorage.getItem(SPLASH_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [minDone, setMinDone] = useState(() => {
    try {
      return sessionStorage.getItem(SPLASH_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    init();
    if (minDone) return;
    const id = setTimeout(() => {
      setMinDone(true);
      try {
        sessionStorage.setItem(SPLASH_KEY, '1');
      } catch {
        /* stockage indisponible */
      }
    }, 1500);
    return () => clearTimeout(id);
  }, [init]); // eslint-disable-line react-hooks/exhaustive-deps
  const routes = (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="product/:slug" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="favorites" element={<Favorites />} />
        <Route
          path="checkout"
          element={
            <RequireAuth>
              <Checkout />
            </RequireAuth>
          }
        />
        {['privacy', 'terms', 'legal-notice', 'cookies', 'returns', 'shipping-policy', 'payment-policy'].map((p) => (
          <Route key={p} path={p} element={<LegalPage />} />
        ))}
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<Forgot />} />
        <Route path="reset-password" element={<Reset />} />
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="profile" element={<Profile />} />
          <Route path="addresses" element={<Addresses />} />
          <Route path="messages" element={<Messages />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="security" element={<Security />} />
        </Route>
        <Route path="categories" element={<Navigate to="/shop" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/admin/orders/:id/label"
        element={
          <RequireAdmin>
            <OrderLabel />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="customers/:id" element={<AdminCustomerDetail />} />
        <Route path="newsletter" element={<AdminNewsletter />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="promotions" element={<AdminPromotions />} />
        <Route path="shipping" element={<AdminShipping />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="homepage" element={<AdminHomepage />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
  return (
    <MotionConfig reducedMotion="user">
      <LangScopeContext.Provider value={scope}>
        <LangSync />
        <ScrollToTop />
        <Toaster />
        <AnimatePresence>{!splashSeen && !(ready && minDone) && <SplashLoader key="splash" />}</AnimatePresence>
        <Suspense fallback={<PageSpinner />}>{scope === 'admin' ? <AdminLanguageGate>{routes}</AdminLanguageGate> : routes}</Suspense>
      </LangScopeContext.Provider>
    </MotionConfig>
  );
}
