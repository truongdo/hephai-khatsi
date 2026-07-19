describe('Home page', () => {
  it('loads the welcome heading', () => {
    cy.visit('/')
    cy.contains('h1', 'Welcome to TanStack Start').should('be.visible')
  })
})
