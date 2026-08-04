import { createRouter, createWebHistory } from 'vue-router'
import { useGameSession } from '@/composables/useGameSession'

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('@/views/Home.vue'),
    meta: { title: 'Reaction Rush' }
  },
  {
    path: '/game',
    name: 'game',
    component: () => import('@/views/Game.vue'),
    meta: { title: '测试中', requiresGame: true }
  },
  {
    path: '/result',
    name: 'result',
    component: () => import('@/views/Result.vue'),
    meta: { title: '测试结果', requiresGame: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const gameSession = useGameSession()

  if (to.meta.requiresGame && !gameSession.hasValidState()) {
    next({
      path: '/home',
      query: { flash: '测试进度已重置' }
    })
    return
  }

  if (to.meta.title) {
    document.title = `${to.meta.title} - Reaction Rush`
  }

  next()
})

export default router