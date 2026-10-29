// Returns the image currently deployed to a container app or job so re-provisioning does not revert azd deployments.
param name string
param isJob bool = false

resource existingApp 'Microsoft.App/containerApps@2024-03-01' existing = if (!isJob) {
  name: name
}

resource existingJob 'Microsoft.App/jobs@2024-03-01' existing = if (isJob) {
  name: name
}

output image string = isJob ? existingJob.properties.template.containers[0].image : existingApp.properties.template.containers[0].image
