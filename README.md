# Genesys Cloud Interaction Viewer

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
*   **Direct Interaction Link:**  Easily navigate to the full interaction details in Genesys Cloud for deeper analysis.

## Prerequisites

1.  **Configure Environment Variables:**

    *   `GC_OAUTH_CLIENT_ID`:  Your Genesys Cloud OAuth Client ID (Implicit Grant).
  
## Running Instructions

1.  **View Interaction Details:** The application will load, authenticate with Genesys Cloud, and display the conversation history and details for the provided conversation ID.

    *   **Conversation List:**  Recent conversations will be grouped by media type.
    *   **Expandable Sections:** Click on "Transcription" and "Summary" headers to expand and load these sections on demand.
    *   **Conversation ID Links:** Click on the conversation IDs to open the interaction in Genesys Cloud Admin UI in a new tab.
