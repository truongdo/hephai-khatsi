describe('Home page', () => {
  it('loads the Vietnamese welcome heading', () => {
    cy.visit('/')
    cy.document().its('documentElement.lang').should('eq', 'vi')
    cy.contains('h1', 'Chào mừng đến với TanStack Start').should('be.visible')
  })
})
