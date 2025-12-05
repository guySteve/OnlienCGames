# Automated Testing Script for VegasCore
# Runs all critical test suites to ensure functional integrity

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   VEGASCORE AUTOMATED TESTING SUITE" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Environment Check
Write-Host "`n[1/4] Checking Environment..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "✅ node_modules found" -ForegroundColor Green
} else {
    Write-Host "⚠️ node_modules missing. Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# 2. Comprehensive Static & Unit Tests
Write-Host "`n[2/4] Running Comprehensive Static & Unit Tests..." -ForegroundColor Yellow
try {
    node test/comprehensive-tests.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Comprehensive tests passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Comprehensive tests failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error running comprehensive tests" -ForegroundColor Red
    exit 1
}

# 3. Game Engine Logic Tests
Write-Host "`n[3/4] Running Game Engine Logic Tests..." -ForegroundColor Yellow
try {
    npm run test:games
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Game engine tests passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Game engine tests failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error running game engine tests" -ForegroundColor Red
    exit 1
}

# 4. Regression Tests
Write-Host "`n[4/4] Running Regression Tests..." -ForegroundColor Yellow
try {
    node test-regression.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Regression tests passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Regression tests failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error running regression tests" -ForegroundColor Red
    exit 1
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "   ALL TESTS PASSED - APP IS FUNCTIONALLY GOOD" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
