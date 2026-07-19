describe('Home page', () => {
  it('loads the Vietnamese welcome heading', () => {
    cy.visit('/')
    cy.document().its('documentElement.lang').should('eq', 'vi')
    cy.contains('h1', 'Hệ phái Khất Sĩ').should('be.visible')
  })
})
