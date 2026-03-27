import { lookupAddresses } from '../services/callerIdService.js';

async function test() {
  console.log('Testing postcode lookup...');
  
  // Test a known valid postcode
  // "NG11AA"
  const validPostcode = "NG1 1AA"; 
  console.log(`Looking up ${validPostcode}...`);
  const result = await lookupAddresses(validPostcode);
  
  if (result && result.source !== 'invalid_postcode') {
    console.log('Lookup successful:', result);
  } else {
    console.log('Lookup failed or invalid:', result);
  }

  // invalid postcode
  const invalidPostcode = "XX1 1XX";
  console.log(`Looking up ${invalidPostcode}...`);
  const invalidResult = await lookupAddresses(invalidPostcode);
  
  if (invalidResult && invalidResult.source === 'invalid_postcode') {
    console.log('Invalid postcode correctly identified:', invalidResult);
  } else {
    console.log('Invalid postcode check failed:', invalidResult);
  }
}

test();
