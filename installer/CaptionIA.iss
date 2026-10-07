#ifndef MyAppVersion
  #define MyAppVersion "3.3.0"
#endif

#define MyAppName "Caption IA"
#define MyPublisher "Escotilha Produtora"

[Setup]
AppId={{B4AD763E-AD1E-4D47-90D4-5123431733A0}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyPublisher}
DefaultDirName={userappdata}\Adobe\CEP\extensions\CaptionIA
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=output
OutputBaseFilename=CaptionIA-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
Uninstallable=yes
UninstallDisplayName=Caption IA
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyPublisher}
VersionInfoDescription=Instalador do Caption IA para Adobe Premiere Pro
VersionInfoProductName=Caption IA
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "..\CaptionIA\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
Type: filesandordirs; Name: "{userappdata}\Adobe\CEP\extensions\CaptionIA"
Type: filesandordirs; Name: "{userappdata}\Adobe\CEP\extensions\editBest"
Type: filesandordirs; Name: "{userappdata}\Adobe\CEP\extensions\FrameSpeed"
Type: filesandordirs; Name: "{userappdata}\Adobe\CEP\extensions\framespeed"

[Registry]
Root: HKCU; Subkey: "Software\Adobe\CSXS.9"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Adobe\CSXS.10"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Adobe\CSXS.13"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Adobe\CSXS.14"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Adobe\CSXS.15"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
  MsgBox(
    'Feche o Adobe Premiere Pro antes de continuar.' + #13#10 + #13#10 +
    'O instalador vai remover versões antigas do Caption IA, editBest ou FrameSpeed e instalar a versão atual.' + #13#10 +
    'Suas preferências em Documentos\editBest não serão apagadas.',
    mbInformation,
    MB_OK
  );
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if not FileExists(ExpandConstant('{app}\CSXS\manifest.xml')) then
      MsgBox('A instalação terminou, mas o manifest.xml não foi encontrado. Reinstale o Caption IA.', mbError, MB_OK);
  end;
end;
