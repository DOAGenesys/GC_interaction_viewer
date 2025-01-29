# Genesys Cloud Interaction Viewer

## Overview

The Genesys Cloud Interaction Viewer is a web application designed to provide a comprehensive view of customer interactions within Genesys Cloud, designed to be deployed as an interaction widget within a Genesys Cloud organization. Starting with a specific Genesys Cloud conversation ID provided via interaction widget integration, the application retrieves and displays a historical timeline of related interactions for the associated customer. This tool is very valuable for agents to quickly grasp the context of a customer's journey and understand their engagement history.

## Key Features

*   **Conversation History Timeline:** Displays a chronologically ordered list of interactions related to the customer of the initial conversation, categorized by media type (Voice, Message, Email).
*   **Interaction Filtering:** Allows filtering of conversation history by interaction status (Attended, Unattended, Other, All) to focus on specific types of engagements. Interaction statuses are derived from the last event of each session.
*   **On-Demand Interaction Details:** Provides expandable sections for each interaction to view:
    *   **Transcription:** Fetches and displays the transcript of voice and message interactions, including speaker identification and identified topics. For emails, it shows the subject and body.
    *   **Summary:** Presents a summarized view of the conversation, including reason, follow-up actions, and resolution, when available.
    *   **Analytics:** Displays key conversation analytics such as sentiment score, sentiment trend, and empathy scores to provide insights into the interaction's emotional tone and agent empathy.
*   **Direct Genesys Cloud Interaction Link:** Each conversation ID is a direct, clickable link that opens the full interaction details in the Genesys Cloud Admin UI in a new tab, enabling seamless transition to the Genesys Cloud environment for deeper investigation or action.
*   **User-Friendly Interface:**  Features a clean, modern, and intuitive user interface for easy navigation and information consumption.
*   **Status Filtering with Select2:** Implements a user-friendly, searchable, multi-select dropdown for filtering interactions by status using the Select2 library.
*   **Loading and Error Handling:** Includes visual loading indicators and error messages to provide feedback during data retrieval processes, enhancing the user experience.
*   **Responsive Design:**  Designed to be responsive and accessible across various screen sizes and devices.


## Prerequisites

Before running the Genesys Cloud Interaction Viewer, ensure you have the following prerequisites in place:

1.  **Genesys Cloud Interaction Widget Integration:** Deploy this as an interaction widget pointing to `https://<your_domain>/?langTag={{gcLangTag}}&gcTargetEnv={{gcTargetEnv}}&gcHostOrigin={{gcHostOrigin}}&conversationId={{gcConversationId}}`

    *   **Iframe Sandbox Options:** When configuring the Interaction Widget, ensure the following **Iframe Sandbox Options** are set to guarantee proper functionality:
        `allow-scripts,allow-same-origin,allow-forms,allow-modals,allow-popups`

2.  **Genesys Cloud OAuth Client:**
    *   You need to configure an OAuth Client in your Genesys Cloud organization with **Implicit Grant** type.
    *   Note the **Client ID** of this OAuth client, as it will be needed to configure the application.
    *   The OAuth Client should have the necessary permissions to access Genesys Cloud APIs, including:
        *   `analytics:conversationdetails:view`
        *   `journey:externalcontacts:view`
        *   `speechandtextanalytics:conversation:view`
        *   `speechandtextanalytics:conversationcommunication:view`
        *   `conversations:transcription:view`
        *   `conversations:summary:view`
3.  **Environment Variable Configuration:**
    *   Set the `GC_OAUTH_CLIENT_ID` environment variable to the Client ID of your Genesys Cloud OAuth client. This is necessary for the application to authenticate with Genesys Cloud.
4.  **Domain setup:**
    *   Set the `redirectUri` constant in startGCSDKs.js as per your domain.

## Running Instructions

1.  **Using the Interaction Viewer:**
    *   **Conversation History Display:** Once authenticated and initialized, the application will display the conversation history related to the customer of the provided `conversationId`.
    *   **Filtering Conversations:** Use the "Filter by Status" dropdown to filter the displayed conversations based on their status (All, Unattended, Attended, Other).
    *   **Viewing Interaction Details:** Click on the headers ("Transcription", "Summary", "Analytics") of each session item to expand and view the respective details. The details are loaded on demand to improve initial loading performance.
    *   **Navigating to Genesys Cloud:** Click on the conversation ID links to open the specific interaction in the Genesys Cloud Admin UI in a new tab for further actions or detailed analysis.

##  Important Notes

*   **Error Handling:** The application includes error handling to gracefully manage API call failures and display informative error messages to the user. Check the browser's developer console for detailed error logs if issues arise.
*   **Performance:**  Loading of transcriptions, summaries, and analytics is done on demand to ensure the initial page load is fast and efficient.
*   **Security:**  The application uses the Implicit Grant OAuth flow, which is suitable for client-side applications. Ensure your OAuth Client is properly configured with the minimum required permissions.

### Status Categories

The status categories (Unattended, Attended, Other) are assigned based on the `lastEvent.eventName` of each conversation session. The logic is as follows:

*   **Unattended:**  Assigned if the `lastEvent.eventName` is one of the following, indicating a flow or ACD interaction that started but did not reach agent interaction:
    *   `com.genesys.analytics.detailevents.FlowStartEvent`
    *   `com.genesys.analytics.detailevents.AcdStartEvent`
    *   `com.genesys.analytics.detailevents.FlowEndEvent`
*   **Attended:** Assigned if the `lastEvent.eventName` indicates an interaction that was handled by an agent and concluded:
    *   `com.genesys.analytics.detailevents.AcdEndEvent`
    *   `com.genesys.analytics.detailevents.AfterCallWorkEvent`
*   **Other:** Assigned if the `lastEvent.eventName` does not match the criteria for "Unattended" or "Attended", or if `lastEvent` or `eventName` is missing. This category serves as a fallback for sessions that do not neatly fit into the "Unattended" or "Attended" categories.
