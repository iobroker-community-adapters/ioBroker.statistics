# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

**Statistics Adapter Context:**
- **Primary Purpose**: Provides comprehensive statistical analysis for ioBroker state values
- **Key Features**: Calculate min/max, averages, sum deltas, impulse counting, time-based statistics
- **Statistics Types**: Daily, weekly, monthly, yearly, and custom period statistics
- **Data Processing**: Real-time statistical calculations with cron-based scheduling
- **Configuration**: JSON-based admin interface with custom statistics configuration
- **Storage**: Persistent storage of both temporary (temp) and saved (save) statistical values

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Test specific functionality here
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
            });
        });
    }
});
```

**Statistics Adapter Specific Testing:**
- Test statistical calculations with known datasets
- Verify cron job timing and execution
- Test state creation and updates for different statistic types
- Validate handling of missing or invalid source data
- Test persistence of saved vs temporary statistics

## API Development Patterns

### State Management Best Practices

#### State Creation and Object Definitions
Always create states with proper object definitions first:
```javascript
await this.setObjectNotExistsAsync(stateId, {
    type: 'state',
    common: {
        name: 'State name',
        type: 'number',
        role: 'value',
        read: true,
        write: false,
        unit: sourceUnit, // Copy from source state
        def: 0
    },
    native: {}
});
```

#### State Updates
Use `setState` for value updates:
```javascript
await this.setStateAsync(stateId, {
    val: calculatedValue,
    ack: true,
    ts: timestamp
});
```

#### State Queries and Subscriptions  
Subscribe to relevant states and handle changes:
```javascript
// Subscribe to all states for monitoring
this.subscribeForeignStates('*');

// Handle state changes
onStateChange(id, state) {
    if (state && !state.ack && this.config.enabledStates.includes(id)) {
        this.processStatisticsUpdate(id, state);
    }
}
```

### Adapter Lifecycle Management

#### Initialization Pattern
```javascript
async onReady() {
    try {
        // Initialize adapter
        this.log.info('Starting adapter initialization');
        
        // Setup configuration
        await this.initializeConfiguration();
        
        // Setup cron jobs
        this.setupCronJobs();
        
        // Subscribe to states
        this.subscribeForeignStates('*');
        
        // Set started indicator
        await this.setStateAsync('info.started', true, true);
        
        this.log.info('Adapter initialization completed');
    } catch (error) {
        this.log.error(`Initialization failed: ${error.message}`);
    }
}
```

#### Cleanup Pattern
```javascript
async onUnload(callback) {
  try {
    // Clear all timers and intervals
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    
    // Clear cron jobs
    if (this.cronJobs) {
      this.cronJobs.forEach(job => job.destroy());
      this.cronJobs = [];
    }
    
    // Clear connection timer if exists
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```

**Statistics Adapter Specific Patterns:**
- Use cron library for scheduled statistical calculations
- Implement proper state value history tracking
- Handle configuration changes for statistical groups dynamically
- Ensure atomic updates for related statistical values

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

**Statistics Adapter Specific Standards:**
- Use descriptive names for statistical calculation methods
- Implement comprehensive error handling for mathematical operations
- Ensure proper decimal precision in statistical calculations
- Use constants for statistical calculation types and periods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

**Statistics Adapter Testing Note:**
The statistics adapter doesn't require external API credentials, as it operates on internal ioBroker state data. Focus testing on statistical calculation accuracy and cron job reliability.