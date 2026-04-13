// test-mock.js

import { ai } from "./index.js";

async function test() {
  // Test intent classification
  const intent = await ai.classifyIntent('I want to terminate student Damilola');
  console.log('Intent:', intent);
  
  // Test query generation
  const query = await ai.generateQuery('Show me all students in Computer Science');
  console.log('Query:', query);
  
  // Test streaming
  await ai.streamResponse('Tell me about students', (chunk) => {
    process.stdout.write(chunk);
  });
}

test();