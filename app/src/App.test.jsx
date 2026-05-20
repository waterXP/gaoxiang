import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

vi.mock('./data/books.js', () => ({
  books: [
    {
      id: 'book-001',
      title: '信息系统项目管理师',
      subtitle: '2026 考试重点汇总 V23.0',
      chapters: [
        {
          title: '第十一章 项目管理概论',
          startPage: 172,
        },
      ],
      allChapterPages: [
        [
          {
            page: 172,
            type: '普通',
            content: [
              'h2:第十一章 项目管理概论',
              '项目执行过程中，经常要做好{{point:ch11-integrated-change-control|实施整体变更控制}}。',
            ],
          },
        ],
      ],
    },
  ],
}))

vi.mock('./hooks/useStorage.js', () => ({
  useStorage: () => ({
    state: {},
    update: vi.fn(),
  }),
}))

describe('App point interactions', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('opens a point modal from an inline point reference', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByText('第十一章 项目管理概论', { selector: '.ch-label' }),
    )
    await user.click(screen.getByRole('button', { name: '实施整体变更控制' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('定义、作用')).toBeInTheDocument()
  })

  it('renders standalone point view from the query string', async () => {
    window.history.replaceState(
      null,
      '',
      '/?book=book-001&ch=0&point=ch11-integrated-change-control',
    )

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('定义、作用')).toBeInTheDocument()
    })

    expect(
      screen.getByText('第十一章 项目管理概论', { selector: '.ch-label' }),
    ).toBeInTheDocument()
  })
})
