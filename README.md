# Terraform Scrape
Scraping tool used to try to extract data from the terraform docs for the https://github.com/erd0s/terraform-autocomplete Visual Studio Code extension.

## NOTE
This is only attempting to scrape from the AWS provider code. I haven't tried on any other providers but please feel free to contribute!

## Running
`docker run -ti dirkdirk/terraform-scrape`

This will output any notices to stderr and output the json that needs to go in terraform-autocomplete/aws-resources.json to stdout. So you could do something like `docker run -ti dirkdirk/terraform-scrape > ../terraform-autocomplete/aws-resources.json`