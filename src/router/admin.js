import Vue from 'vue'
import VueRouter from 'vue-router'

import UserView from '@/views/admin/UserView.vue'
import UsersView from '@/views/admin/UsersView.vue'
import EmailsView from '@/views/admin/EmailsView.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'users',
    component: UsersView
  },
  {
    path: '/users/:username',
    name: 'user-detail',
    component: UserView,
    props: true
  },
  {
    path: '/emails',
    name: 'emails',
    component: EmailsView
  },
  // {
  //   path: '/about',
  //   name: 'About',
  //   // route level code-splitting
  //   // this generates a separate chunk (about.[hash].js) for this route
  //   // which is lazy-loaded when the route is visited.
  //   component: () => import(/* webpackChunkName: "about" */ '../views/About.vue')
  // }
]

const router = new VueRouter({
  mode: 'history',
  base: '/' + location.pathname.slice(1).split('/')[0],
  // base: import.meta.env.MODE === 'development' ? '/admin/' : import.meta.env.BASE_URL,
  // base: import.meta.env.BASE_URL,
  routes
})

export default router
