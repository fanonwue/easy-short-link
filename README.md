# Easy Short-Link
[![build-container](https://github.com/fanonwue/easy-short-link/actions/workflows/build-container.yml/badge.svg)](https://github.com/fanonwue/easy-short-link/actions/workflows/build-container.yml)

This project contains a small link-shortener application based on NodeJS. At this stage, it only supports
Google Sheets as it's data source, although more sources could be added in the future.

## Installation
Since only Google Sheets is supported at the moment, you'll have to create your own app in the [Google Cloud
Platform Console](https://console.cloud.google.com/). You'll then need to add at least the _Google Sheets API_
to your app, although it is recommended to also add the _Google Drive API_ since this allows us to check
the last modification time of the target spreadsheet and potentially skipping an update if it's not necessary.

To authenticate with the Google API you'll need to either use a service account (recommended) or OAuth2

### Using a service account
Open the _APIs and services_ page of your project, and click on _client credentials_. Use the menu at the top
to create a new set of credentials, and choose _service account_. Give it a name and a fitting description.
You'll then need to add a key, choose _JSON_ when asked. Save the key using the name `service-account.json`
the the `config` folder of this application.
The app should then be able to authenticate with the Google API.

To be able to access your spreadsheet, you'll need to share the spreadsheet with the service account.
Just open your spreadsheet, and share it with the e-mail address of your service user.

### OAuth2
Work in Progress


