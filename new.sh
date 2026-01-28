# --- MISSION: THE RESIDENT ---

# MISSION STEP 1: PUSH TO GITHUB
# ---------------------------------------------------------
git remote add origin https://github.com/TEARN1/TheResident.git
git add .
git commit -m "Deployment Mission: Stage 1 - GitHub"
git push -u origin master

# MISSION STEP 2: PREPARE GOOGLE CLOUD
# ---------------------------------------------------------
# Set the Project ID (Using ID instead of Number)
gcloud config set project the-resident-485213

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com

# MISSION STEP 3: BUILD & DEPLOY
# ---------------------------------------------------------
gcloud builds submit --tag gcr.io/the-resident-485213/the-resident
gcloud run deploy the-resident --image gcr.io/the-resident-485213/the-resident --platform managed --region us-central1 --allow-unauthenticated --port 3000
