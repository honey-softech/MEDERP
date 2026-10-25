// Some Flutter plugins still hardcode compileSdk 34. AGP locks that value
// before afterEvaluate, so patch the plugin scripts before they are evaluated.
gradle.beforeProject {
    if (this == rootProject) return@beforeProject
    val scripts = listOf(buildFile, file("local-config.gradle")).filter { it.isFile }
    for (script in scripts) {
        val original = script.readText()
        val updated = original
            .replace(Regex("""compileSdkVersion\s+34"""), "compileSdkVersion 36")
            .replace(Regex("""compileSdk\s*=\s*34"""), "compileSdk = 36")
            .replace(Regex("""compileSdk\s+34"""), "compileSdk 36")
            .replace("compileSdk=34", "compileSdk=36")
        if (updated != original) {
            script.writeText(updated)
        }
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
