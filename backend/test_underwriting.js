const { assess } = require('./services/UnderwritingEngine');

function printResult(label, inputs) {
  console.log('\n' + '='.repeat(60));
  console.log('SCENARIO:', label);
  console.log('='.repeat(60));
  const result = assess(inputs);
  console.log('Risk Score:            ', result.risk_score, '/ 100');
  console.log('Risk Level:            ', result.risk_level.toUpperCase());
  console.log('Probability of Default:', (result.probability_of_default * 100).toFixed(1) + '%');
  console.log('Income/Rent Ratio:     ', result.income_rent_ratio + 'x');
  console.log('\nREASONING:');
  result.reasoning.forEach(r => console.log('  >', r));
  console.log('\nFACTOR BREAKDOWN:');
  Object.entries(result.factor_breakdown).forEach(([k, v]) => {
    console.log(' ', k.padEnd(30), (v >= 0 ? '+' : '') + v, 'pts');
  });
}

printResult('Ideal Tenant (expect: LOW)', {
  monthlyIncome: 120000, rentAmount: 25000,
  employmentStabilityMonths: 36, kycStatus: 'approved',
  city: 'Mysore', furnishingLevel: 'unfurnished', priorDefaults: 0,
});

printResult('Average Tenant (expect: MEDIUM)', {
  monthlyIncome: 60000, rentAmount: 25000,
  employmentStabilityMonths: 10, kycStatus: 'approved',
  city: 'Pune', furnishingLevel: 'semi_furnished', priorDefaults: 0,
});

printResult('High-Risk Tenant (expect: HIGH)', {
  monthlyIncome: 30000, rentAmount: 22000,
  employmentStabilityMonths: 3, kycStatus: 'pending',
  city: 'Mumbai', furnishingLevel: 'fully_furnished', priorDefaults: 2,
});

printResult('Incomplete Data (expect: MEDIUM-HIGH)', {
  monthlyIncome: null, rentAmount: 20000,
  employmentStabilityMonths: null, kycStatus: 'pending',
  city: 'Bangalore', furnishingLevel: 'semi_furnished', priorDefaults: 0,
});

console.log('\n' + '='.repeat(60));
console.log('All scenarios done.');
console.log('='.repeat(60));
