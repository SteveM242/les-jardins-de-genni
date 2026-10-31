import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import PanierDetailView from "../views/PanierDetailView.vue";
import NotFoundView from "../views/NotFoundView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/panier/:slug", component: PanierDetailView },
    { path: "/:pathMatch(.*)*", component: NotFoundView }
  ],
  scrollBehavior: () => ({ top: 0 })
});

export default router;
