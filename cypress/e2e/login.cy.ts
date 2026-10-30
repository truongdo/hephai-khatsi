describe('Login page', () => {
  it('shows Google and email sign-in controls', () => {
    cy.visit('/login')
    cy.contains('h1', 'Đăng nhập').should('be.visible')
    cy.contains('button', 'Tiếp tục với Google').should('be.visible')
    cy.get('input[type="email"]').should('be.visible')
  })
})
