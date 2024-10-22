/// <reference types="cypress" />

describe('login to Eagle Eye', () => {
  beforeEach(() => {
    // Cypress starts out with a blank slate for each test
    // so we must tell it to visit our website with the `cy.visit()` command.
    // Since we want to visit the same URL at the start of all our tests,
    // we include it in our beforeEach function so that it runs before each test
    cy.visit('http://localhost:80')
    cy.get('#username').type('admin')
    cy.get('#password').type('EagleEye2023')
    cy.get('#submit').click()
  })
  it('joins and leaves a meeting', () =>{
    cy.get('#meeting-number-input').type('3454530783')
    cy.get('#join-meeting-btn').click()
    cy.get('#stat-meeting', {timeout: 10000}).should('contain', '3454530783')
    cy.get('#leave-meeting-btn').click()
    cy.get('#stat-meeting').should('contain', 'No')
  })
  // it('streams', () =>{
  //   cy.get('#stream').click()
  //   // Assert that the page is redirected to the streaming page
  //   cy.url().should('include', 'stream')
  // });
})