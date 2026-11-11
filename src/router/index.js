import { nextTick } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { setPageTitle, titleForPath } from "../pageMeta.js";
import HomeView from "../views/HomeView.vue";
import PanierDetailView from "../views/PanierDetailView.vue";
import CatalogView from "../views/CatalogView.vue";
import ComposeView from "../views/ComposeView.vue";
import CheckoutView from "../views/CheckoutView.vue";
import HowItWorksView from "../views/HowItWorksView.vue";
import AboutView from "../views/AboutView.vue";
import ContactView from "../views/ContactView.vue";
import LoginView from "../views/account/LoginView.vue";
import SignupView from "../views/account/SignupView.vue";
import ForgotPasswordView from "../views/account/ForgotPasswordView.vue";
import ResetPasswordView from "../views/account/ResetPasswordView.vue";
import VerifyEmailView from "../views/account/VerifyEmailView.vue";
import UnsubscribeReminderView from "../views/account/UnsubscribeReminderView.vue";
import AdminPrepView from "../views/admin/AdminPrepView.vue";
import AdminSystemView from "../views/admin/AdminSystemView.vue";
import AccountView from "../views/account/AccountView.vue";
import AdminLoginView from "../views/admin/AdminLoginView.vue";
import AdminDashboardView from "../views/admin/AdminDashboardView.vue";
import AdminProductsView from "../views/admin/AdminProductsView.vue";
import AdminBasketsView from "../views/admin/AdminBasketsView.vue";
import AdminDiscountsView from "../views/admin/AdminDiscountsView.vue";
import AdminSiteView from "../views/admin/AdminSiteView.vue";
import AdminUsersView from "../views/admin/AdminUsersView.vue";
import AdminAccountView from "../views/admin/AdminAccountView.vue";
import SocialsView from "../views/SocialsView.vue";
import LegalNoticeView from "../views/LegalNoticeView.vue";
import PrivacyView from "../views/PrivacyView.vue";
import TermsView from "../views/TermsView.vue";
import NotFoundView from "../views/NotFoundView.vue";
import { useAuth } from "../stores/auth.js";
import { useAdminAuth } from "../stores/adminAuth.js";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/produits", component: CatalogView },
    { path: "/composer", component: ComposeView },
    { path: "/panier/:slug", component: PanierDetailView },
    { path: "/commande", component: CheckoutView },
    { path: "/comment-ca-marche", component: HowItWorksView },
    { path: "/a-propos", component: AboutView },
    { path: "/contact", component: ContactView },
    { path: "/reseaux", component: SocialsView },
    { path: "/mentions-legales", component: LegalNoticeView },
    { path: "/confidentialite", component: PrivacyView },
    { path: "/conditions", component: TermsView },
    { path: "/compte/connexion", component: LoginView, meta: { guestOnly: "customer" } },
    { path: "/compte/inscription", component: SignupView, meta: { guestOnly: "customer" } },
    { path: "/compte/mot-de-passe-oublie", component: ForgotPasswordView, meta: { guestOnly: "customer" } },
    { path: "/compte/reinitialiser", component: ResetPasswordView },
    { path: "/compte/verification", component: VerifyEmailView },
    { path: "/rappel/desabonnement", component: UnsubscribeReminderView },
    { path: "/compte", component: AccountView, meta: { requiresCustomer: true } },
    { path: "/admin/connexion", component: AdminLoginView, meta: { bare: true, guestOnly: "admin" } },
    { path: "/admin", component: AdminDashboardView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/systeme", component: AdminSystemView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/preparation", component: AdminPrepView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/articles", component: AdminProductsView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/paniers", component: AdminBasketsView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/contenu", component: AdminSiteView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/galerie", redirect: "/admin/contenu" },
    { path: "/admin/utilisateurs", component: AdminUsersView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/compte", component: AdminAccountView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/promos", component: AdminDiscountsView, meta: { bare: true, requiresAdmin: true } },
    { path: "/:pathMatch(.*)*", component: NotFoundView }
  ],
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 90 } : { top: 0 })
});

router.beforeEach(async (to) => {
  if (to.meta.requiresCustomer) {
    const auth = useAuth();
    if (!auth.state.loaded) await auth.fetchMe();
    if (!auth.state.customer) return "/compte/connexion";
  }

  if (to.meta.requiresAdmin) {
    const adminAuth = useAdminAuth();
    if (!adminAuth.state.loaded) await adminAuth.fetchMe();
    if (!adminAuth.state.admin) return "/admin/connexion";
  }

  // Déjà connecté·e : on saute l'écran de connexion et on va directement au bon espace.
  if (to.meta.guestOnly === "customer") {
    const auth = useAuth();
    if (!auth.state.loaded) await auth.fetchMe();
    if (auth.state.customer) return "/compte";
  }

  if (to.meta.guestOnly === "admin") {
    const adminAuth = useAdminAuth();
    if (!adminAuth.state.loaded) await adminAuth.fetchMe();
    if (adminAuth.state.admin) return "/admin";
  }

  return true;
});

// Titre d'onglet + focus sur le contenu à chaque navigation (lecteurs d'écran, clavier).
router.afterEach((to, from) => {
  if (!to.path.startsWith("/panier/")) setPageTitle(titleForPath(to.path));
  if (from.name !== undefined || from.matched.length > 0) {
    nextTick(() => document.getElementById("contenu")?.focus({ preventScroll: true }));
  }
});

export default router;
