/**
 * ACCESSIBILITY TESTING (WCAG 2.1 Compliance)
 * Tests: ARIA labels, keyboard navigation, screen reader support, color contrast
 * Tool: axe-core accessibility engine
 */

const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function runAccessibilityAudit() {
  console.log('♿ ACCESSIBILITY AUDIT STARTING...');
  console.log(`Target URL: ${BASE_URL}\n`);
  
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Test main pages
    const pagesToTest = [
      { url: `${BASE_URL}/`, name: 'Homepage' },
      { url: `${BASE_URL}/welcome.html`, name: 'Welcome Page' },
      { url: `${BASE_URL}/admin.html`, name: 'Admin Panel' }
    ];
    
    let totalViolations = 0;
    const violationsByPage = [];
    
    for (const { url, name } of pagesToTest) {
      console.log(`\n🔍 Testing: ${name}`);
      console.log(`URL: ${url}`);
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
        
        // Run axe-core audit
        const results = await new AxePuppeteer(page)
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        
        const violations = results.violations;
        totalViolations += violations.length;
        
        if (violations.length === 0) {
          console.log('✅ No accessibility violations found');
        } else {
          console.log(`⚠️  Found ${violations.length} violations:`);
          
          violations.forEach((violation, index) => {
            console.log(`\n   ${index + 1}. ${violation.id} (${violation.impact})`);
            console.log(`      ${violation.description}`);
            console.log(`      Affected elements: ${violation.nodes.length}`);
            
            // Show first affected element
            if (violation.nodes.length > 0) {
              const node = violation.nodes[0];
              console.log(`      Example: ${node.html.substring(0, 100)}...`);
            }
          });
          
          violationsByPage.push({
            page: name,
            violations: violations
          });
        }
        
      } catch (error) {
        console.log(`❌ Could not test ${name}: ${error.message}`);
      }
    }
    
    // Additional manual checks
    console.log('\n\n🔍 MANUAL ACCESSIBILITY CHECKS');
    console.log('='.repeat(60));
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    
    // Check 1: Keyboard navigation
    console.log('\n1. Keyboard Navigation Test');
    const focusableElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('a, button, input, select, textarea, [tabindex]');
      let focusableCount = 0;
      let withoutTabindex = 0;
      
      elements.forEach(el => {
        const tabindex = el.getAttribute('tabindex');
        if (tabindex !== '-1') {
          focusableCount++;
          if (tabindex === null) {
            withoutTabindex++;
          }
        }
      });
      
      return { focusableCount, withoutTabindex };
    });
    
    console.log(`   Focusable elements: ${focusableElements.focusableCount}`);
    console.log(`   Natural tab order: ${focusableElements.withoutTabindex}`);
    console.log(`   ${focusableElements.focusableCount > 0 ? '✅' : '❌'} Keyboard navigation available`);
    
    // Check 2: Color contrast
    console.log('\n2. Color Contrast Check');
    const contrastIssues = await page.evaluate(() => {
      const issues = [];
      const textElements = document.querySelectorAll('p, span, a, button, h1, h2, h3, h4, h5, h6, label');
      
      textElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;
        
        // Simple check: if text color is too light on light background
        if (color.includes('255') && bgColor.includes('255')) {
          issues.push(el.tagName);
        }
      });
      
      return issues.length;
    });
    
    console.log(`   Potential contrast issues: ${contrastIssues}`);
    console.log(`   ${contrastIssues === 0 ? '✅' : '⚠️'} ${contrastIssues === 0 ? 'No obvious contrast issues' : 'Some elements may need review'}`);
    
    // Check 3: Form labels
    console.log('\n3. Form Labels Test');
    const formAccessibility = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      let withLabel = 0;
      let withAriaLabel = 0;
      let withPlaceholder = 0;
      let unlabeled = 0;
      
      inputs.forEach(input => {
        if (input.labels && input.labels.length > 0) {
          withLabel++;
        } else if (input.getAttribute('aria-label')) {
          withAriaLabel++;
        } else if (input.placeholder) {
          withPlaceholder++;
        } else {
          unlabeled++;
        }
      });
      
      return { total: inputs.length, withLabel, withAriaLabel, withPlaceholder, unlabeled };
    });
    
    console.log(`   Total form controls: ${formAccessibility.total}`);
    console.log(`   With <label>: ${formAccessibility.withLabel}`);
    console.log(`   With aria-label: ${formAccessibility.withAriaLabel}`);
    console.log(`   With placeholder only: ${formAccessibility.withPlaceholder}`);
    console.log(`   Unlabeled: ${formAccessibility.unlabeled}`);
    console.log(`   ${formAccessibility.unlabeled === 0 ? '✅' : '⚠️'} Form accessibility`);
    
    // Check 4: Images alt text
    console.log('\n4. Image Alt Text Test');
    const imageAccessibility = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      let withAlt = 0;
      let withoutAlt = 0;
      let decorative = 0;
      
      images.forEach(img => {
        const alt = img.getAttribute('alt');
        if (alt === '') {
          decorative++;
        } else if (alt) {
          withAlt++;
        } else {
          withoutAlt++;
        }
      });
      
      return { total: images.length, withAlt, withoutAlt, decorative };
    });
    
    console.log(`   Total images: ${imageAccessibility.total}`);
    console.log(`   With alt text: ${imageAccessibility.withAlt}`);
    console.log(`   Decorative (alt=""): ${imageAccessibility.decorative}`);
    console.log(`   Missing alt: ${imageAccessibility.withoutAlt}`);
    console.log(`   ${imageAccessibility.withoutAlt === 0 ? '✅' : '❌'} Image accessibility`);
    
    // Check 5: ARIA landmarks
    console.log('\n5. ARIA Landmarks Test');
    const landmarks = await page.evaluate(() => {
      return {
        main: document.querySelectorAll('main, [role="main"]').length,
        nav: document.querySelectorAll('nav, [role="navigation"]').length,
        header: document.querySelectorAll('header, [role="banner"]').length,
        footer: document.querySelectorAll('footer, [role="contentinfo"]').length
      };
    });
    
    console.log(`   <main> or role="main": ${landmarks.main}`);
    console.log(`   <nav> or role="navigation": ${landmarks.nav}`);
    console.log(`   <header> or role="banner": ${landmarks.header}`);
    console.log(`   <footer> or role="contentinfo": ${landmarks.footer}`);
    console.log(`   ${landmarks.main > 0 ? '✅' : '⚠️'} Landmark structure`);
    
    // Final summary
    console.log('\n\n📊 ACCESSIBILITY AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Violations (axe-core):   ${totalViolations}`);
    console.log(`Critical Issues:               ${violationsByPage.filter(p => p.violations.some(v => v.impact === 'critical')).length}`);
    console.log(`Keyboard Navigation:           ${focusableElements.focusableCount > 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Form Accessibility:            ${formAccessibility.unlabeled === 0 ? '✅ PASS' : '⚠️  WARNINGS'}`);
    console.log(`Image Alt Text:                ${imageAccessibility.withoutAlt === 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`ARIA Landmarks:                ${landmarks.main > 0 ? '✅ PASS' : '⚠️  MISSING'}`);
    
    const criticalIssues = totalViolations > 10 || imageAccessibility.withoutAlt > 0;
    
    if (criticalIssues) {
      console.log('\n❌ ACCESSIBILITY AUDIT FAILED');
      console.log('   Recommendation: Fix violations before production deployment\n');
      process.exit(1);
    } else if (totalViolations > 0) {
      console.log('\n⚠️  ACCESSIBILITY AUDIT PASSED WITH WARNINGS');
      console.log('   Recommendation: Review and fix violations for better accessibility\n');
      process.exit(0);
    } else {
      console.log('\n✅ ACCESSIBILITY AUDIT PASSED\n');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ AUDIT ERROR:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run audit
runAccessibilityAudit();
