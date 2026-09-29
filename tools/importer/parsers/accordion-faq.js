/* eslint-disable */
/* global WebImporter */

/**
 * Parser for accordion-faq block
 * 
 * Source: https://www.asianpaints.com/services/interior-design-solutions.html
 * Base Block: accordion
 * 
 * Block Structure:
 * - Each row: [question cell, answer cell]
 * 
 * Source HTML Pattern:
 * <div class="faq">
 *   <div class="q-and-a faqComponent">
 *     <div class="main-title">FAQs</div>
 *     <div class="js-faqDropDown each-container">
 *       <div class="accord">
 *         <div class="question">What are some interior design themes?</div>
 *       </div>
 *       <div class="answer">
 *         <span><p>Answer content...</p></span>
 *       </div>
 *     </div>
 *   </div>
 * </div>
 * 
 * Generated: 2026-01-28
 */
export default function parse(element, { document }) {
  // Find all FAQ items
  const faqItems = element.querySelectorAll('.js-faqDropDown, .each-container, [class*="faq-item"]');
  
  const cells = [];
  
  faqItems.forEach(item => {
    // Extract question
    const questionEl = item.querySelector('.question, [class*="question"], .accord h3, .accord h4');
    
    // Extract answer
    const answerEl = item.querySelector('.answer, [class*="answer"]');
    
    if (questionEl && answerEl) {
      // Question cell - just the text
      const questionText = questionEl.textContent.trim();
      
      // Answer cell - preserve HTML structure for rich content
      const answerContent = answerEl.querySelector('span') || answerEl;
      const answerClone = answerContent.cloneNode(true);
      
      cells.push([questionText, answerClone]);
    }
  });
  
  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Accordion-Faq', cells });
  
  // Replace original element with structured block table
  element.replaceWith(block);
}
