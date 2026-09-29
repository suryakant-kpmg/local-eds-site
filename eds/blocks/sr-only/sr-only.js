export default function decorate(block) {
  // No JS needed — CSS handles the sr-only hiding.
  // Block exists so EDS auto-loads the CSS when the block is used.
  block.setAttribute('aria-hidden', 'false');
}
