import { nextTick } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { setPageTitle, titleForPath } from "../pageMeta.js";
import HomeView from "../views/HomeView.vue";
import PanierDetailView from "../views/PanierDetailView.vue";
import CatalogView from "../views/CatalogView.vue";
import CheckoutView from "../views/CheckoutView.vue";
import HowItWorksView from "../views/HowItWorksView.vue";
import AboutView from "../views/AboutView.vue";
import ContactView from "../views/ContactView.vue";
import LoginView from "../views/account/LoginView.vue";
import SignupView from "../views/account/SignupView.vue";
import AccountView from "../views/account/AccountView.vue";
import AdminLoginView from "../views/admin/AdminLoginView.vue";
import AdminDashboardView from "../views/admin/AdminDashboardView.vue";
import AdminProductsView from "../views/admin/AdminProductsView.vue";
import AdminBasketsView from "../views/admin/AdminBasketsView.vue";
import AdminDiscountsView from "../views/admin/AdminDiscountsView.vue";
import NotFoundView from "../views/NotFoundView.vue";
import { useAuth } from "../stores/auth.js";
import { useAdminAuth } from "../stores/adminAuth.js";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/produits", component: CatalogView },
    { path: "/panier/:slug", component: PanierDetailView },
    { path: "/commande", component: CheckoutView },
    { path: "/comment-ca-marche", component: HowItWorksView },
    { path: "/a-propos", component: AboutView },
    { path: "/contact", component: ContactView },
    { path: "/compte/connexion", component: LoginView, meta: { guestOnly: "customer" } },
    { path: "/compte/inscription", component: SignupView, meta: { guestOnly: "customer" } },
    { path: "/compte", component: AccountView, meta: { requiresCustomer: true } },
    { path: "/admin/connexion", component: AdminLoginView, meta: { bare: true, guestOnly: "admin" } },
    { path: "/admin", component: AdminDashboardView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/articles", component: AdminProductsView, meta: { bare: true, requiresAdmin: true } },
    { path: "/admin/paniers", component: AdminBasketsView, meta: { bare: true, requiresAdmin: true } },
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
