# TAS Vet ROTA Dialer

A Genesys Cloud integration widget that enables automated dialing to on-call veterinarians based on the current rota schedule.

## Overview

### Workflow
When a callback interaction is initiated, the widget automatically:
1. Retrieves the callback information, including customer data and the associated queue
2. Queries the AWS "GC_TAS_ROTA_Demo" dynamoDB table to determine the correct veterinarian to be contacted based on the current datetime
3. Presents this information in the widget's user interface
4. When an agent clicks the Dial button, it places an outbound call to the veterinarian on behalf of the queue used for the callback

This application is a Genesys Cloud widget that integrates with an AWS backend to fetch active veterinarian details and facilitate direct dialing. It's designed to work within the Genesys Cloud interface, allowing agents to quickly connect customers with the currently on-call veterinarian.

## Required Configuration

### Genesys Cloud Phone Settings
- "Phone Settings" > "Placing calls with another app?" must be enabled in the GC UI

### AWS Backend Configuration
- A REST API endpoint must be deployed on AWS API Gateway
- The API Gateway endpoint must be configured to invoke a Lambda function
- The Lambda function should be set up to query the "GC_TAS_ROTA_Demo" DynamoDB table
- The Lambda function should use appropriate IAM roles with permissions to:
  - Read from the DynamoDB table
  - Execute within the API Gateway context
  - Access any necessary AWS resources

## Technical Architecture

### Components

1. **Frontend Application**
   - Runs as a Genesys Cloud interaction widget
   - Integrates with Genesys Cloud JavaScript and client app SDKs
   - Communicates with AWS backend via API endpoints

2. **Backend Integration**
   - AWS API Gateway endpoints
   - Lambda function for business logic
   - DynamoDB table for data storage
   - Environment-based configuration
   - Secure API key authentication

3. **AWS Lambda Function**
   - Queries "GC_TAS_ROTA_Demo" DynamoDB table
   - Processes datetime-based lookups
   - Returns formatted veterinarian data
   - Implements error handling and logging

## API Flows

### 1. Application Initialization

```mermaid
sequenceDiagram
    participant UI as UI
    participant GC as Genesys Cloud
    participant AWS as AWS
    
    rect rgb(40, 44, 52)
        UI->>+GC: Implicit Grant Authentication
        Note over UI,GC: OAuth 2.0 flow begins
        GC->>-UI: Return authentication token
        
        UI->>+GC: Get User Details (getUsersMe)
        GC->>-UI: Return current user information
        
        UI->>+GC: Get Conversation Details
        Note over UI,GC: Using conversationId from URL
        GC->>-UI: Return conversation participants & queue info
        
        UI->>+AWS Gateway: Fetch Active Vet Details
        Note over UI,AWS API Gateway: Using current datetime
        AWS API Gateway->>+Lambda: Invoke Lambda function
        Lambda->>+DynamoDB: Query table
        DynamoDB->>-Lambda: Return vet data
        Lambda->>-AWS API Gateway: Process and return data
        AWS API Gateway->>-UI: Return on-call vet contact info
        
        UI->>UI: Update Interface
        Note over UI: Populate form fields<br/>Enable/disable dial button
    end
```

### 2. Genesys Cloud API Endpoints Used

#### Authentication
- **Endpoint**: Implicit Grant OAuth 2.0
- **Purpose**: Initial authentication
- **Parameters**:
  - `clientId`: OAuth client ID
  - `redirectUri`: Application redirect URI

#### User Details
- **Endpoint**: `GET /api/v2/users/me`
- **Purpose**: Fetch current user information
- **Used In**: `startGCSDKs.js`

#### Conversation Details
- **Endpoint**: `GET /api/v2/conversations/callbacks/{conversationId}`
- **Purpose**: Fetch conversation participant details
- **Parameters**:
  - `conversationId`: Active conversation identifier
- **Response Data Used**:
  - Customer participant details
  - Queue ID
  - External contact ID

#### Call Initiation
- **Endpoint**: `POST /api/v2/conversations/calls`
- **Purpose**: Initiate outbound call
- **Parameters**:
  ```json
  {
    "phoneNumber": "string",
    "callFromQueueId": "string",
    "externalContactId": "string",
    "label": "string"
  }
  ```

### 3. Custom API Endpoints

#### Get Active Vet
- **Endpoint**: `GET /api/getActiveVet`
- **Purpose**: Fetch current on-call veterinarian details
- **Integration**: AWS Lambda function
- **DynamoDB Table**: GC_TAS_ROTA_Demo
- **Parameters**:
  - `datetime`: ISO timestamp
- **Headers**:
  - `X-Api-Key`: AWS API authentication
  - `Content-Type`: application/json
- **Lambda Function**:
  - Queries DynamoDB based on current datetime
  - Processes and formats veterinarian data
  - Implements error handling
  - Returns formatted response

#### Get Configuration
- **Endpoint**: `GET /api/getConfig`
- **Purpose**: Fetch application configuration
- **Response**:
  ```json
  {
    "clientId": "string"
  }
  ```

## Application Flow

1. **Initialization**
   - Load application configuration
   - Initialize Genesys Cloud SDKs
   - Authenticate user
   - Extract conversation ID from URL

2. **Data Gathering**
   - Fetch conversation details from Genesys Cloud
   - Get current veterinarian details from AWS Lambda via API Gateway
   - Update UI with gathered information

3. **Call Initiation**
   - User clicks "Dial" button
   - Application validates destination number
   - Initiates call via Genesys Cloud API
   - Displays success/failure message

## Environment Variables

- `GC_OAUTH_CLIENT_ID`: Genesys Cloud OAuth client ID
- `AWS_API_ENDPOINT`: AWS API Gateway endpoint
- `AWS_API_KEY`: AWS API authentication key

## Security Considerations

1. **API Authentication**
   - Genesys Cloud OAuth 2.0 Implicit Grant
   - AWS API Key authentication
   - Lambda execution role permissions
   - DynamoDB table access controls
   - Environment variable protection

2. **Data Protection**
   - No sensitive data storage in localStorage
   - Minimal data persistence
   - Secure communication protocols
   - Encrypted data transmission

## Error Handling

The application implements comprehensive error handling:
- API call failures
- Lambda function errors
- DynamoDB query issues
- Missing conversation IDs
- Invalid veterinarian data
- Network connectivity issues

## Logging

Extensive logging is implemented throughout the application:
- API call tracking
- Lambda function execution logs
- DynamoDB query monitoring
- Error logging
- User action logging
- State changes
- All logs are prefixed with "TAS Vet ROTA Dialer" for easy filtering
