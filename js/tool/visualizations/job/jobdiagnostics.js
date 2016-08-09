"use strict";
class JobDiagnostics{

    constructor( diagnostics){
        this.diagnostics = diagnostics;
    }

    updateView(jobInfoJson,jobCountersJson) {
        this.diagnostics.clearJobs();
        this.job = JSON.parse(jobInfoJson, function (k, v) {
            return v;
        });
        this.job = this.job.job;
        this.jobCountersJson = JSON.parse(jobCountersJson, function (k, v) {
            return v;
        }).jobCounters;
        this.checkForSpilling();
        this.checkCombiner();

    }

    checkCombiner(){
        let combinerInput = this.getJobCounter("org.apache.hadoop.mapreduce.TaskCounter", "COMBINE_INPUT_RECORDS")["mapCounterValue"];
        if(combinerInput == 0){
            return this.createReport("Optional usage of combiner", "warning", "The job doesn't use a combiner.");
        }
        let combinerOutput = this.getJobCounter("org.apache.hadoop.mapreduce.TaskCounter", "COMBINE_OUTPUT_RECORDS")["mapCounterValue"];
        console.log("combiner input " + combinerInput + " " + combinerOutput);
        let percentage = (1.0 - (combinerOutput * 1.0)/combinerInput).toFixed(4) * 100;
        let test = percentage < 0.3;
        console.log(test)
        if(test){
            return this.createReport("Inefficient usage of combiner", "warning", "The jobs combiner reduces the output with " + percentage+
                "% which may not result in performance improvements.")
        }else{
            return this.createReport("Inefficient usage of combiner", "success", "The jobs combiner reduces the output with " + percentage+
                "% which may not result in performance improvements.")
        }
    }

    checkForSpilling(){
        console.log('checking for spilling');
        this.checkSpillAndReport("Map spilling", "mapCounterValue");
        this.checkSpillAndReport("Reduce spilling", "reduceCounterValue");

    }

    checkSpillAndReport(title, type){
        let outputrecords = 0;
        if(type.localeCompare("mapCounterValue") == 0) {
            outputrecords = this.getJobCounter("org.apache.hadoop.mapreduce.TaskCounter", "MAP_OUTPUT_RECORDS")[type];
        }else{
            outputrecords = this.getJobCounter("org.apache.hadoop.mapreduce.TaskCounter", "REDUCE_OUTPUT_RECORDS")[type];
        }
        let spilledrecords = this.getJobCounter("org.apache.hadoop.mapreduce.TaskCounter","SPILLED_RECORDS")[type];
        let spilled= spilledrecords -  outputrecords;
        if(spilled != 0){
            let description = "During the job " + spilled + " records are spilled.";
            if(type.localeCompare("mapCounterValue") == 0){
                let bytes = this.getJobCounter("org.apache.hadoop.mapreduce.FileSystemCounter","FILE_BYTES_READ")[type];
                description += "This resulted in " + bytes + " bytes needed to be read from local disc.";
                description += " Hint: use mapreduce.task.io.sort.mb and mapreduce.map.sort.spill.percent settings to resolve this issue.";

            }else{
                description += " Hint: use mapreduce.task.io.sort.mb and mapreduce.map.sort.spill.percent settings to resolve this issue.";
            }
            this.createReport(title,"danger",description);
        }else{
            this.createReport(title,"success", "no spilling during this job.")
        }
    }

    createReport(title, type, description){
        let element = document.createElement("div");
        element.innerHTML = '<div class="panel '+this.diagnostics.getPanelType(type)+ '"> <div class="panel-heading">'+ title +'</div> <div class="panel-body">'+description+ '</div> </div>';
        this.diagnostics.addJobDiagnostic(element);
    }





    getJobCounter(counterGroupName, counterName){
        var groupIndex = 0;
        var counterGroups = this.jobCountersJson["counterGroup"];
        for(groupIndex = 0; groupIndex < counterGroups.length; groupIndex++){
            var counterGroup = counterGroups[groupIndex];
            var counterIndex = 0;
            if(counterGroup["counterGroupName"].localeCompare(counterGroupName) == 0){
                for(counterIndex = 0; counterIndex < counterGroup.counter.length ; counterIndex++){
                    var counter = counterGroup.counter[counterIndex];
                    if(counter["name"].localeCompare(counterName) == 0){
                        return counter;
                    }
                }
            }

        }
    }
}