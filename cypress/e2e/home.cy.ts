describe('Home page', () => {
  it('sends anonymous users to login', () => {
    cy.visit('/')
    cy.url().should('include', '/login')
    cy.contains('h1', 'Đăng nhập').should('be.visible')
  })
})
