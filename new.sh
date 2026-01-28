# --- MISSION: THE RESIDENT ---

# 1. GITHUB SETUP
# Run these to push your code to GitHub
# git remote add origin https://github.com/TEARN1/TheResident.git
# git add .
# git commit -m "Fresh start for deployment"
# git push -u origin main

# 2. GOOGLE CLOUD LOGIN
# Run this in the Google Cloud SDK Shell
# gcloud auth login

# 3. CONFIGURE PROJECT
# Replace [ID] with your real Project ID from: gcloud projects list
# gcloud config set project [ID]

# 4. BUILD & DOCKERIZE
# gcloud builds submit --tag gcr.io/[ID]/the-resident

# 5. LAUNCH TO CLOUD RUN
# gcloud run deploy the-resident --image gcr.io/[ID]/the-resident --platform managed --region us-central1 --allow-unauthenticated --port 3000
