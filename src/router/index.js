import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import PanierDetailView from "../views/PanierDetailView.vue";
import CheckoutView from "../views/CheckoutView.vue";
import HowItWorksView from "../views/HowItWorksView.vue";
import AboutView from "../views/AboutView.vue";
import ContactView from "../views/ContactView.vue";
import NotFoundView from "../views/NotFoundView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/panier/:slug", component: PanierDetailView },
    { path: "/commande", component: CheckoutView },
    { path: "/comment-ca-marche", component: HowItWorksView },
    { path: "/a-propos", component: AboutView },
    { path: "/contact", component: ContactView },
    { path: "/:pathMatch(.*)*", component: NotFoundView }
  ],
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 90 } : { top: 0 })
});

export default router;
