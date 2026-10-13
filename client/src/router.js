import { createRouter, createWebHistory } from 'vue-router';
import CityList from './components/City.vue';
import CityDetail from './components/CityDetail.vue';
import TravelAssistant from './components/TravelAssistant.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'destinations', component: CityList },
    { path: '/destinations/:id', name: 'destination-detail', component: CityDetail },
    { path: '/assistant', name: 'assistant', component: TravelAssistant },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 };
  },
});

export default router;