import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderContent } from './renderContent.jsx'

const pointMap = {
  'ch11-project-is-temporary': {
    id: 'ch11-project-is-temporary',
    content: ['项目是为创造独特的产品、服务或成果而进行的临时性工作。（掌握）'],
  },
  'ch11-integrated-change-control': {
    id: 'ch11-integrated-change-control',
    content: [
      'h4:定义、作用',
      {
        headers: ['关注点', '说明'],
        rows: [['变更请求', '需要统一审查']],
      },
    ],
  },
}

describe('renderContent point support', () => {
  it('renders inline point expansion with prefix', () => {
    render(
      <div>
        {renderContent(
          [{ point: 'ch11-project-is-temporary', prefix: '1、' }],
          { pointMap },
        )}
      </div>,
    )

    expect(
      screen.getByText('1、项目是为创造独特的产品、服务或成果而进行的临时性工作。（掌握）'),
    ).toBeInTheDocument()
  })

  it('renders inline string references as clickable elements', async () => {
    const onPointClick = vi.fn()
    const user = userEvent.setup()

    render(
      <div>
        {renderContent(
          ['项目执行过程中，经常要做好{{point:ch11-integrated-change-control|实施整体变更控制}}。'],
          { pointMap, onPointClick },
        )}
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '实施整体变更控制' }))
    expect(onPointClick).toHaveBeenCalledWith('ch11-integrated-change-control')
  })

  it('renders nested point content with existing DSL support', () => {
    render(
      <div>
        {renderContent(
          [{ point: 'ch11-integrated-change-control', prefix: '2、' }],
          { pointMap },
        )}
      </div>,
    )

    expect(screen.getByText('定义、作用')).toBeInTheDocument()
    expect(screen.getByText('关注点')).toBeInTheDocument()
    expect(screen.getByText('变更请求')).toBeInTheDocument()
  })

  it('shows a visible placeholder when a point id is missing', () => {
    render(
      <div>
        {renderContent(
          [{ point: 'missing-point-id', prefix: '9、' }],
          { pointMap },
        )}
      </div>,
    )

    expect(screen.getByText(/missing point/i)).toBeInTheDocument()
  })
})
