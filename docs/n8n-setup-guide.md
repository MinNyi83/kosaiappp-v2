# n8n Docker Setup & Integration Guide

This guide covers how to set up n8n locally using Docker and how to configure it to talk to your local Cloudflare Worker (`wrangler dev`).

## Prerequisites
- **Docker Desktop** installed on your machine.

---

## 1. Starting n8n via Docker

Open your terminal or command prompt and run the following command. This will spin up a local instance of n8n and save its data to a persistent volume so you don't lose your workflows when the container restarts.

```bash
docker volume create n8n_data

docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

- `-p 5678:5678` exposes n8n to your local browser on port 5678.
- `-v n8n_data:/home/node/.n8n` saves your workflows, credentials, and settings permanently.

## 2. Accessing the Dashboard

Once the terminal says n8n is ready, open your browser and go to:
[http://localhost:5678](http://localhost:5678)

Follow the on-screen prompts to set up your owner account.

---

## 3. Important Networking Rule (Docker to Host)

Because n8n is running *inside* an isolated Docker container, it does not know what `localhost` or `127.0.0.1` means in the context of your host machine (where Cloudflare Wrangler is running).

If you want an n8n HTTP Request node to send data to your local Cloudflare Worker (which runs at `http://127.0.0.1:8787`), **you MUST use the following hostname instead of localhost:**

```text
http://host.docker.internal:8787
```

### Examples for your HTTP Request Nodes:

**To check stock:**
- **URL**: `http://host.docker.internal:8787/api/external/inventory/search?q=cctv`
- **Method**: GET

**To create a ticket (Facebook Trigger):**
- **URL**: `http://host.docker.internal:8787/api/external/jobs/create`
- **Method**: POST
- **Send Body**: JSON
- **Body Data**: 
  ```json
  {
    "client_id": "Individual",
    "job_description": "Facebook inquiry: needs a new CCTV installed.",
    "service_type": "CCTV",
    "technician_telegram": "@YourTechHandle"
  }
  ```

---

## 4. Useful n8n Nodes for your Workflow

To build the Facebook integration, you will rely heavily on these nodes:

1. **Facebook Messenger Trigger**: Listens for incoming messages from your connected page.
2. **Google Gemini (or OpenAI)**: Feed it the incoming message to determine the customer's intent (`intent: 'stock' | 'service'`).
3. **Switch Node**: Create a branching path. Route 1 goes to stock search, Route 2 goes to job creation.
4. **HTTP Request**: To call the Cloudflare Worker endpoints mentioned above.
5. **Facebook Messenger (Action)**: Sends a reply back to the user on Facebook ("We have stock!" or "I've created a ticket!").

## 5. Adding Environment Variables (Optional)
If you ever want n8n to use specific environment variables (like timezone or webhook URLs), you can add them to the run command using `-e`:

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e GENERIC_TIMEZONE="Asia/Yangon" \
  -e TZ="Asia/Yangon" \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```
