describe('Admin', () => {
  it('sends anonymous users from /admin to login with return path', () => {
    cy.visit('/admin/temples')
    cy.url().should('include', '/login')
    cy.url().should('include', 'redirect')
    cy.contains('h1', 'Đăng nhập').should('be.visible')
  })
})
