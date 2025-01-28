# Genesys Cloud Unattended Interaction Viewer

## Description

The Genesys Cloud Interaction Viewer is a web application designed to display a historical view of customer interactions within Genesys Cloud. Starting with a specific conversation ID, the application retrieves and presents related interaction details, including:

*   **Conversation History:** Lists recent conversations associated with the customer involved in the initial conversation.
*   **Conversation Details:** For each conversation, it displays key information like ID, direction, subject (for emails), and creation date.
*   **Transcription (On Demand):** Allows users to expand and view the transcript of a conversation.
*   **Summary (On Demand):** Provides a summary, reason, follow-up, and resolution of the conversation.
*   **Direct Link to Interaction:**  Conversation IDs are clickable links that open the interaction in the Genesys Cloud Admin UI in a new tab.

This tool helps agents and administrators quickly understand the context of a customer interaction by providing a consolidated view of their recent engagement history and conversation insights.

## Features

*   **View Conversation History:** Retrieve and display a list of recent conversations for a customer, categorized by media type (e.g., Email, Voice).
*   **Filter by Interaction Type:**  Focus on conversations initiated by flows or queues, filtering out other event types.
*   **On-Demand Transcription:** Fetch and display conversation transcripts only when needed, improving initial load times.
*   **Conversation Summary:** Access and display conversation summaries, including reason, follow-up, and resolution details, on demand.
*   **Genesys Cloud UI Aligned Styling:**  The application's styling is designed to be visually consistent with the Genesys Cloud user interface for a seamless user experience.
*   **Direct Interaction Link:**  Easily navigate to the full interaction details in Genesys Cloud for deeper analysis.
*   **Modular Codebase:**  Well-structured code with separate files for API calls and UI logic for maintainability and scalability.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js and npm:**  Node.js is required to run the development server and manage project dependencies. npm (Node Package Manager) comes bundled with Node.js. You can download them from [https://nodejs.org/](https://nodejs.org/).
*   **Genesys Cloud Account:** You need access to a Genesys Cloud organization to use this application.
*   **Genesys Cloud OAuth Client:** You will need to create an OAuth Client in your Genesys Cloud organization with **Implicit Grant** type.  Make sure to configure the **Redirect URI** for your application (e.g., `http://localhost:8080` if running locally). You will need the **Client ID** from this OAuth client.

2.  **Configure Environment Variables:**
    You need to set the following environment variables.  For local development, you can either set them directly in your terminal session or use a `.env` file in the project root (you will need to install `dotenv` if you choose to use a `.env` file and load it in your server-side code, though this example is client-side only, so adjust accordingly based on your serving method).

    *   `GC_OAUTH_CLIENT_ID`:  Your Genesys Cloud OAuth Client ID (Implicit Grant).
    *   `REDIRECT_URI`: The Redirect URI you configured in your Genesys Cloud OAuth Client to allow this app.
  
## Running Instructions

1.  **View Interaction Details:** The application will load, authenticate with Genesys Cloud, and display the conversation history and details for the provided conversation ID.

    *   **Conversation List:**  Recent conversations will be grouped by media type.
    *   **Expandable Sections:** Click on "Transcription" and "Summary" headers to expand and load these sections on demand.
    *   **Conversation ID Links:** Click on the conversation IDs to open the interaction in Genesys Cloud Admin UI in a new tab.

## API Endpoints

The application utilizes the following backend API endpoints (implemented as serverless functions or similar in a real-world deployment) to interact with Genesys Cloud APIs:

*   `/api/getConfig.js`: Returns configuration parameters like `clientId` and `redirectUri` from environment variables.
*   `/api/getConversationDetails.js`: Fetches detailed information about a specific conversation using the Genesys Cloud Conversations API (`getAnalyticsConversationDetails`).
*   `/api/getExternalContactSessions.js`: Retrieves recent sessions for a given external contact using the Genesys Cloud Journey API (`getExternalcontactsContactJourneySessions`).
*   `/api/getTranscriptUrl.js`:  Gets a pre-signed S3 URL for the transcript of a specific communication within a conversation using the Genesys Cloud Speech and Text Analytics API (`getSpeechandtextanalyticsConversationCommunicationTranscripturl`).
*   `/api/getConversationSummary.js`: Retrieves the summary of a conversation using the Genesys Cloud Conversations API (`getConversationSummaries`).
