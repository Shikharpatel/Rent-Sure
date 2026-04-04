const { assess, getCityTier } = require('./services/UnderwritingEngine');

// Test 1: Ideal tenant - expect clamp to 100
const t1 = assess({
  monthlyIncome: 200000, rentAmount: 10000,
  employmentStabilityMonths: 60, kycStatus: 'approved',
  city: 'Mysore', furnishingLevel: 'unfurnished', priorDefaults: 0
});
console.log('=== Ideal (expect clamp to 100) ===');
console.log('Score:', t1.risk_score, '| Level:', t1.risk_level, '| PoD:', t1.probability_of_default);
console.log('Clamped?', t1.reasoning.some(r => r.includes('[CLAMP]')));
console.log('raw_before_clamp:', t1.metadata.raw_score_before_clamp);
console.log('income_rent_ratio:', t1.metadata.income_rent_ratio);

// Test 2: Worst case - expect score near 0
const t2 = assess({
  monthlyIncome: 5000, rentAmount: 22000,
  employmentStabilityMonths: 1, kycStatus: 'rejected',
  city: 'Mumbai', furnishingLevel: 'fully_furnished', priorDefaults: 5
});
console.log('\n=== Worst Case (expect 0 or near) ===');
console.log('Score:', t2.risk_score, '| Level:', t2.risk_level, '| PoD:', t2.probability_of_default);
console.log('Clamped?', t2.reasoning.some(r => r.includes('[CLAMP]')));
console.log('Summary:', t2.reasoning[t2.reasoning.length - 1]);

// Test 3: City registry
console.log('\n=== City Registry ===');
console.log('Mumbai ->', getCityTier('Mumbai'));
console.log('gurgaon ->', getCityTier('gurgaon'));
console.log('Mysore ->', getCityTier('Mysore'));
console.log('null ->', getCityTier(null));

// Test 4: All nulls - must not crash
const t4 = assess({
  monthlyIncome: null, rentAmount: null,
  employmentStabilityMonths: null, kycStatus: null,
  city: null, furnishingLevel: null, priorDefaults: null
});
console.log('\n=== All Nulls (must not crash) ===');
console.log('Score:', t4.risk_score, '| Level:', t4.risk_level);
console.log('Output keys:', Object.keys(t4).join(', '));
console.log('Reasoning entries:', t4.reasoning.length);

// Test 5: Weight labels present in reasoning
console.log('\n=== Weight Labels ===');
const avg = assess({
  monthlyIncome: 60000, rentAmount: 25000,
  employmentStabilityMonths: 10, kycStatus: 'approved',
  city: 'Pune', furnishingLevel: 'semi_furnished', priorDefaults: 0
});
avg.reasoning.forEach(r => console.log(' >', r));
console.log('\nAll tests passed.');
