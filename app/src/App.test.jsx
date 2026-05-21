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
              '请查看{{point:ch11-1|项目的临时性}}。',
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
    await user.click(screen.getByRole('button', { name: '项目的临时性' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByText(/项目是为创造独特的产品、服务或成果而进行的/),
    ).toBeInTheDocument()
    expect(screen.getByText('临时性')).toBeInTheDocument()
    expect(screen.getByText('23年11月第4批考题')).toBeInTheDocument()
  })

  it('renders standalone point view from the query string', async () => {
    window.history.replaceState(
      null,
      '',
      '/?book=book-001&ch=0&point=ch11-1',
    )

    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByText(/项目是为创造独特的产品、服务或成果而进行的/),
      ).toBeInTheDocument()
    })

    expect(screen.getByText('临时性')).toBeInTheDocument()
    expect(screen.getByText('23年11月第4批考题')).toBeInTheDocument()
    expect(
      screen.getByText('第十一章 项目管理概论', { selector: '.ch-label' }),
    ).toBeInTheDocument()
  })
})
